import { Model, Page, TransactionOrKnex } from 'objection-2';
import { AccessControl as AC3 } from 'role-acl-3';
import { AccessControl as AC4 } from 'role-acl-4';

declare module 'objection-authorize' {
  class AuthQueryBuilder<M extends Model, R = M[]> {
    ArrayQueryBuilderType: AuthQueryBuilder<M, M[]>;
    SingleQueryBuilderType: AuthQueryBuilder<M, M>;
    NumberQueryBuilderType: AuthQueryBuilder<M, number>;
    PageQueryBuilderType: AuthQueryBuilder<M, Page<M>>;

    insert<T>(body: T): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];

    insertAndFetch<T>(body: T): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];

    patch<T>(body: T): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];

    patchAndFetch<T>(body: T): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];

    patchAndFetchById<T>(id: number, body: T): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];

    update<T>(body: T): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];

    updateAndFetch<T>(body: T): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];

    updateAndFetchById<T>(id: number, body: T): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];

    delete<T>(body: T): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];

    deleteById<T>(id: number, body: T): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];

    action(): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];

    first<T>(): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];

    authorize<T extends typeof Model>(user: T, resource: object, optOverride: object): this['SingleQueryBuilderType'] & M['QueryBuilderType']['SingleQueryBuilderType'];
  }

  interface AuthInstance<T extends typeof Model> {
    QueryBuilderType: AuthQueryBuilder<this & T['prototype']>;

    $query(trx: TransactionOrKnex): AuthQueryBuilder<Model>['SingleQueryBuilderType'] & this['QueryBuilderType']['SingleQueryBuilderType'];
    $relatedQuery(relation: string, trx: TransactionOrKnex): AuthQueryBuilder<Model>['SingleQueryBuilderType'] & this['QueryBuilderType']['SingleQueryBuilderType'];
  }

  interface AuthStatic<T extends typeof Model> {
    QueryBuilder: typeof AuthQueryBuilder;

    new(): AuthInstance<T> & T['prototype'];
  }

  export default function authorize(acl: typeof AC3 | typeof AC4, library: string, opts?: {
    defaultRole?: string
    unauthenticatedErrorCode?: number
    unauthorizedErrorCode?: number
    userFromResult?: boolean
    contextKey?: string
    roleFromUser?: (user: Model) => string
    resourceAugments?: { true: boolean; false: boolean; undefined: undefined }
  }): <T extends typeof Model>(model: T) => AuthStatic<T> & Omit<T, 'new'> & T['prototype'];
}