import {
  Injectable,
  OnModuleInit,
  Logger,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto/changer-order-status.dto';
import { NATS_SERVICE } from 'src/config/services';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('OrdersService');
  async onModuleInit() {
    await this.$connect();
    this.logger.log(`Database Connected`);
  }
  constructor(
    @Inject(NATS_SERVICE) private readonly client: ClientProxy,
  ) {
    super();
  }
  async create(createOrderDto: CreateOrderDto) {
    try {
      const ids = createOrderDto.items.map(({ productId }) => productId);
      const products: any[] = await firstValueFrom(
        this.client.send(
          { cmd: 'validate_products' },
          {
            ids,
          },
        ),
      );
      const totalAmount = createOrderDto.items.reduce((acc, item) => {
        const price = products.find(
          (product) => product.id === item.productId,
        ).price;
        return (acc += price * item.quantity);
      }, 0);

      const totalItems = createOrderDto.items.reduce((acc, item) => {
        return acc + item.quantity;
      }, 0);

      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map((item) => ({
                quantity: item.quantity,
                productId: item.productId,
                price: products.find((product) => product.id === item.productId)
                  .price,
              })),
            },
          },
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            },
          },
        },
      });
      return {
        ...order,
        OrderItem: order.OrderItem.map((orderItem) => ({
          ...orderItem,
          name: products.find((product) => product.id === orderItem.productId),
        })),
      };
    } catch (error) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Please check logs',
      });
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const totalPages = await this.order.count({
      where: {
        status: orderPaginationDto.status,
      },
    });
    const { page: currentPage, limit: perPage } = orderPaginationDto;

    return {
      data: await this.order.findMany({
        skip: (currentPage - 1) * perPage,
        take: perPage,
        where: {
          status: orderPaginationDto.status,
        },
      }),
      meta: {
        total: totalPages,
        page: currentPage,
        lastPage: Math.ceil(totalPages / perPage),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.order.findUnique({
      where: {
        id,
      },
      include: {
        OrderItem: true,
      },
    });
    if (!order) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with if ${id} not found`,
      });
    }
    const ids = order.OrderItem.map(({ productId }) => productId);
    const products: any[] = await firstValueFrom(
      this.client.send(
        { cmd: 'validate_products' },
        {
          ids,
        },
      ),
    );
    return {
      ...order,
      OrderItem: order.OrderItem.map((orderItem) => ({
        ...orderItem,
        Product: products.find((product) => product.id === orderItem.productId),
      })),
    };
  }

  update(id: number) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
  async changeOrderStatus(changeorderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeorderStatusDto;
    const order = await this.findOne(id);
    if (order.status === status) {
      return order;
    }
    return this.order.update({
      where: {
        id,
      },
      data: {
        status,
      },
    });
  }
}
