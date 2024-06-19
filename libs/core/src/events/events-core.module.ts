import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { SpotsCoreModule } from '../spots/spots-core.module';

@Module({
  imports: [SpotsCoreModule],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsCoreModule {}
