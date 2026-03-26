import { Snowflake } from "@sapphire/snowflake";

const epoch = new Date("2026-01-01T00:00:00.000Z"); // this is arbitrary, just need a fixed point in time for snowflakes to measured from
const snowflake = new Snowflake(epoch);


export function generateSnowflake(): string {
    // .generate returns bigint, so convert to string and then pad with leading zeros.
    return snowflake.generate().toString().padStart(20, '0');
}