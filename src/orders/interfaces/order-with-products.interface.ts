import { OrderStatus  } from '@prisma/client';

export interface OrderWithProducts {
  OrderItem: {
    name: string;
    productId: number;
    quantity: number;
    price: number;
  }[];
  id: string;
  totalAmount: number;
  totalItems: number;
  status: OrderStatus | null;
  paid?: boolean|null;
  paidAt: Date|null;
  createdAt: Date;
  updatedAt: Date;
}
