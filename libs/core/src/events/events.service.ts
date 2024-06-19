import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ReserveSpotDto } from './dto/reserve-spot.dto';
import { Prisma, Spot, SpotStatus, TicketStatus } from '@prisma/client';
import { SpotsService } from '@app/core/spots/spots.service';
import { DefaultArgs } from '@prisma/client/runtime/library';
import { PrismaService } from '@app/core/prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(
    private prismaService: PrismaService,
    private spotService: SpotsService,
  ) {}

  create(createEventDto: CreateEventDto) {
    return this.prismaService.event.create({
      data: createEventDto,
    });
  }

  findAll() {
    return this.prismaService.event.findMany();
  }

  findOne(id: string) {
    return this.prismaService.event.findUnique({
      where: { id },
    });
  }

  update(id: string, updateEventDto: UpdateEventDto) {
    return this.prismaService.event.update({
      data: updateEventDto,
      where: { id },
    });
  }

  remove(id: string) {
    return this.prismaService.event.delete({
      where: { id },
    });
  }

  async reserveSpot(dto: ReserveSpotDto & { eventId: string }) {
    const spots = await this.spotService.findAllWithNameContainedIn(
      dto.eventId,
      dto.spots,
    );

    this.validateSpots(spots, dto.spots);

    try {
      return await this.prismaService.$transaction(
        async (prisma) => {
          await this.createReservationHistory(
            spots,
            dto,
            prisma.reservationHistory,
          );
          await this.updateSpotToReserved(spots, prisma.spot);
          return await this.saveAllTickets(spots, dto, prisma.ticket);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        switch (e.code) {
          case 'P2002': // unique constraint violation
          case 'P2034': // transaction conflict
            throw new Error('Some spots are already reserved');
        }
      }
      throw e;
    }
  }

  private validateSpots(foundSpots: Spot[], spotsDto: string[]) {
    if (foundSpots.length !== spotsDto.length) {
      const foundSpotsName = foundSpots.map((spot) => spot.name);
      const notFoundSpotsName = spotsDto.filter(
        (spotName) => !foundSpotsName.includes(spotName),
      );
      throw new Error(`Spots ${notFoundSpotsName.join(', ')}`);
    }
  }

  private async createReservationHistory(
    spots: Spot[],
    dto: ReserveSpotDto,
    reservationHistoryPrisma: Prisma.ReservationHistoryDelegate<DefaultArgs>,
  ) {
    await reservationHistoryPrisma.createMany({
      data: spots.map((spot) => ({
        spotId: spot.id,
        ticketKind: dto.ticket_kind,
        email: dto.email,
        status: TicketStatus.RESERVED,
      })),
    });
  }

  private async updateSpotToReserved(
    spots: Spot[],
    spotPrisma: Prisma.SpotDelegate<DefaultArgs>,
  ) {
    await spotPrisma.updateMany({
      where: {
        id: {
          in: spots.map((spot) => spot.id),
        },
      },
      data: {
        status: SpotStatus.RESERVED,
      },
    });
  }

  /**
   * Adiciona em paralelo com uso do Promise.all vários tickets.
   */
  private async saveAllTickets(
    spots: Spot[],
    dto: ReserveSpotDto & { eventId: string },
    ticketPrisma: Prisma.TicketDelegate<DefaultArgs>,
  ) {
    return await Promise.all(
      spots.map((spot) =>
        ticketPrisma.create({
          data: {
            spotId: spot.id,
            ticketKind: dto.ticket_kind,
            email: dto.email,
          },
        }),
      ),
    );
  }
}
