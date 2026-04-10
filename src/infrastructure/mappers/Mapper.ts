export interface Mapper<TDomain, TModel, TResponse> {
  toDomain(model: TModel): TDomain;
  toPersistence(domain: TDomain): object;
  toResponse(domain: TDomain): TResponse;
}
