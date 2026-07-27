import { prisma } from "../../lib/prisma";

type ActorType = "CLIENT" | "SYSTEM";

export async function recordEvent(
  collectionRequestId: string,
  eventType: string,
  actorType: ActorType,
  metadata: Record<string, unknown> = {}
) {
  return prisma.collectionEvent.create({
    data: {
      collectionRequestId,
      eventType,
      actorType,
      metadata: JSON.stringify(metadata),
    },
  });
}
