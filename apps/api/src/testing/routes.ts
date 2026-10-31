import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner, ModulesContainer } from '@nestjs/core';

export interface Route {
  method: string;
  path: string;
}

/**
 * Alle Routen der laufenden App, aus den Controllern gelesen. So prüfen Tests neue Routen
 * automatisch mit (PLT-01, PLT-02).
 */
export function discoverRoutes(app: INestApplication): Route[] {
  // Ohne eigenes DiscoveryModule: Die Dienste lesen direkt aus dem Container der laufenden App.
  const discovery = new DiscoveryService(app.get(ModulesContainer));
  const scanner = new MetadataScanner();
  return discovery.getControllers().flatMap(({ instance, metatype }) => {
    if (!instance || !metatype) return [];
    const base = String(Reflect.getMetadata(PATH_METADATA, metatype) ?? '');
    const prototype = Object.getPrototypeOf(instance);
    return scanner.getAllMethodNames(prototype).flatMap((name) => {
      const handler = prototype[name];
      const path = Reflect.getMetadata(PATH_METADATA, handler);
      if (path === undefined) return [];
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
      const full = ['api', base, String(path)]
        .flatMap((part) => part.split('/'))
        .filter(Boolean)
        // Platzhalter wie :id mit einer gültigen UUID füllen, damit die Route überhaupt greift.
        .map((part) => (part.startsWith(':') ? '00000000-0000-7000-8000-000000000000' : part))
        .join('/');
      return [{ method, path: `/${full}` }];
    });
  });
}

/** Ruft eine Route mit oder ohne Token auf; andere Methoden als GET mit leerem JSON-Körper. */
export function callRoute(baseUrl: string, route: Route, token?: string) {
  return fetch(`${baseUrl}${route.path}`, {
    method: route.method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(route.method === 'GET' ? {} : { body: '{}' }),
  });
}
