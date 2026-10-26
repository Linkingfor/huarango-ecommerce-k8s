terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.80, < 7.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # El bucket se indica al iniciar, porque su nombre lleva el número de cuenta:
  #   terraform init -backend-config="bucket=huarango-tfstate-<cuenta>"
  # use_lockfile bloquea el estado con un archivo en S3 (Terraform 1.10+), sin tabla de DynamoDB.
  backend "s3" {
    key          = "lab/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      proyecto    = "huarango-ecommerce"
      ambiente    = "lab"
      responsable = var.responsable
    }
  }
}
