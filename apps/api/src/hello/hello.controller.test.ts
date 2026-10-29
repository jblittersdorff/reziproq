import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HelloController } from './hello.controller.js';

describe('HelloController', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HelloController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('grüßt mit dem übergebenen Namen', async () => {
    const res = await fetch(`${baseUrl}/hello?name=Ada`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Hallo, Ada!' });
  });

  it('lehnt ungültige Eingaben mit 400 ab', async () => {
    const res = await fetch(`${baseUrl}/hello?name=${'x'.repeat(51)}`);
    expect(res.status).toBe(400);
  });
});
