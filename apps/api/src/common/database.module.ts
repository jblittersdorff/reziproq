import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createDatabase, type Database } from '@reziproq/db';

export const DATABASE = Symbol('DATABASE');

export const InjectDatabase = () => Inject(DATABASE);

@Injectable()
class DatabaseConnection implements OnApplicationShutdown {
  readonly connection = createDatabase();

  async onApplicationShutdown() {
    await this.connection.pool.end();
  }
}

@Global()
@Module({
  providers: [
    DatabaseConnection,
    {
      provide: DATABASE,
      useFactory: (conn: DatabaseConnection): Database => conn.connection.db,
      inject: [DatabaseConnection],
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
