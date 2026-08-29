import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const products = await this.prisma.product.findMany({
      include: { category: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category?.name ?? null,
      sellPrice: Number(p.sellPrice),
      active: p.active,
    }));
  }

  findCategories() {
    return this.prisma.productCategory.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async create(dto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (existing) {
      throw new ConflictException(`SKU "${dto.sku}" sudah dipakai.`);
    }
    const product = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        categoryId: dto.categoryId,
        sellPrice: BigInt(dto.sellPrice),
      },
      include: { category: true },
    });
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category?.name ?? null,
      sellPrice: Number(product.sellPrice),
      active: product.active,
    };
  }
}
