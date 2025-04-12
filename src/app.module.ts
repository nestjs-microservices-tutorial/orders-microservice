import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';
import { NatsModule } from './nats/nats.module';


@Module({
  imports: [OrdersModule,NatsModule],
  providers: [],
  controllers:[]
})
export class AppModule {}