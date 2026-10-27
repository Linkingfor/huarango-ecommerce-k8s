// svc-carrito: carrito de compras por cliente sobre Amazon DynamoDB (DynamoDB Local en desarrollo).
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand, UpdateTimeToLiveCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand, DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { crearApp, manejarErrores, iniciar, ErrorHttp } from './lib/http.js';
import { requiereAuth } from './lib/auth.js';
import { log, reintentarAlInicio } from './lib/log.js';
import { resumirCarrito, segundosDeExpiracion, MAX_UNIDADES } from './carrito.js';

const PUERTO = Number(process.env.PORT || 3003);
const TABLA = process.env.CARRITO_TABLE || 'carritos';
const CATALOGO_URL = process.env.CATALOGO_URL || 'http://svc-catalogo:3002';

const dynamo = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
});
const ddb = DynamoDBDocumentClient.from(dynamo, { marshallOptions: { removeUndefinedValues: true } });

let tablaLista = false;
const { app } = crearApp({
  listo: async () => { if (!tablaLista) throw new Error('la tabla de carritos todavía no está disponible'); },
});
const autenticado = requiereAuth();

async function leerCarrito(clienteId) {
  const r = await ddb.send(new QueryCommand({
    TableName: TABLA,
    KeyConditionExpression: 'clienteId = :c',
    ExpressionAttributeValues: { ':c': clienteId },
  }));
  return resumirCarrito(r.Items || []);
}

async function obtenerProducto(productoId) {
  const r = await fetch(`${CATALOGO_URL}/api/catalogo/productos/${encodeURIComponent(productoId)}`, {
    signal: AbortSignal.timeout(2000),
  });
  if (r.status === 404) throw new ErrorHttp(404, 'PRODUCTO_NO_ENCONTRADO', 'El producto no existe');
  if (!r.ok) throw new Error(`catálogo respondió ${r.status}`);
  return r.json();
}

async function guardarItem(clienteId, producto, cantidad) {
  await ddb.send(new PutCommand({
    TableName: TABLA,
    Item: {
      clienteId,
      productoId: producto.id,
      cantidad,
      nombre: producto.nombre,
      precio: producto.precio,
      categoria: producto.categoria,
      imagen: producto.imagen || undefined,
      expiraEn: segundosDeExpiracion(),
    },
  }));
}

app.get('/api/carrito', autenticado, async (req, res) => {
  res.json(await leerCarrito(req.usuario.id));
});

app.post('/api/carrito/items', autenticado, async (req, res) => {
  const productoId = String(req.body?.productoId || '').trim();
  const cantidad = Number(req.body?.cantidad ?? 1);
  if (!productoId || !Number.isInteger(cantidad) || cantidad < 1) {
    throw new ErrorHttp(400, 'DATOS_INVALIDOS', 'Indica el producto y una cantidad mayor a cero');
  }
  const producto = await obtenerProducto(productoId);
  const actual = await ddb.send(new GetCommand({ TableName: TABLA, Key: { clienteId: req.usuario.id, productoId } }));
  const nueva = Math.min((actual.Item?.cantidad || 0) + cantidad, MAX_UNIDADES);
  await guardarItem(req.usuario.id, producto, nueva);
  res.json(await leerCarrito(req.usuario.id));
});

app.put('/api/carrito/items/:productoId', autenticado, async (req, res) => {
  const cantidad = Number(req.body?.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 0) throw new ErrorHttp(400, 'DATOS_INVALIDOS', 'Cantidad inválida');
  const clave = { clienteId: req.usuario.id, productoId: req.params.productoId };
  if (cantidad === 0) {
    await ddb.send(new DeleteCommand({ TableName: TABLA, Key: clave }));
  } else {
    const actual = await ddb.send(new GetCommand({ TableName: TABLA, Key: clave }));
    if (!actual.Item) throw new ErrorHttp(404, 'NO_ENCONTRADO', 'El producto no está en el carrito');
    await ddb.send(new PutCommand({
      TableName: TABLA,
      Item: { ...actual.Item, cantidad: Math.min(cantidad, MAX_UNIDADES), expiraEn: segundosDeExpiracion() },
    }));
  }
  res.json(await leerCarrito(req.usuario.id));
});

app.delete('/api/carrito/items/:productoId', autenticado, async (req, res) => {
  await ddb.send(new DeleteCommand({ TableName: TABLA, Key: { clienteId: req.usuario.id, productoId: req.params.productoId } }));
  res.json(await leerCarrito(req.usuario.id));
});

app.delete('/api/carrito', autenticado, async (req, res) => {
  const { items } = await leerCarrito(req.usuario.id);
  for (let i = 0; i < items.length; i += 25) {
    const lote = items.slice(i, i + 25).map((it) => ({
      DeleteRequest: { Key: { clienteId: req.usuario.id, productoId: it.productoId } },
    }));
    await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLA]: lote } }));
  }
  res.json(await leerCarrito(req.usuario.id));
});

manejarErrores(app);

// En AWS la tabla la crea Terraform. En local (DynamoDB Local) se crea al arrancar si no existe.
async function prepararTabla() {
  try {
    await dynamo.send(new DescribeTableCommand({ TableName: TABLA }));
  } catch (e) {
    if (e.name !== 'ResourceNotFoundException' || process.env.CREAR_TABLA !== 'true') throw e;
    await dynamo.send(new CreateTableCommand({
      TableName: TABLA,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'clienteId', AttributeType: 'S' },
        { AttributeName: 'productoId', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'clienteId', KeyType: 'HASH' },
        { AttributeName: 'productoId', KeyType: 'RANGE' },
      ],
    }));
    await dynamo.send(new UpdateTimeToLiveCommand({
      TableName: TABLA,
      TimeToLiveSpecification: { AttributeName: 'expiraEn', Enabled: true },
    })).catch(() => {});
    log.info('tabla de carritos creada', { tabla: TABLA });
  }
  tablaLista = true;
}

iniciar(app, PUERTO);
reintentarAlInicio('preparar tabla', prepararTabla).catch((e) => log.error('no se pudo preparar la tabla', { error: e.message }));
