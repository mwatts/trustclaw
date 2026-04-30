import { createResumableStreamContext } from "resumable-stream/ioredis";
import {
  getRedisSubscriber,
  getRedisPublisher,
} from "~/server/clients/redis";

export const streamContext = createResumableStreamContext({
  waitUntil: null, // server environment — no need for keep-alive
  subscriber: getRedisSubscriber(),
  publisher: getRedisPublisher(),
});
