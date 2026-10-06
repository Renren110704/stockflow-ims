// Mongoose plugin adding soft-delete support to a schema.
//
// - Adds a `deletedAt` field (null = active).
// - Automatically hides soft-deleted documents from find/count/update
//   queries and aggregations, so existing controllers keep working
//   unchanged and never "see" deleted records by accident.
// - Opt back in per-query with `.setOptions({ includeDeleted: true })`,
//   or for populate with `options: { includeDeleted: true }` — this is how
//   the transaction history still resolves a deleted product's name.
export default function softDelete(schema) {
  schema.add({ deletedAt: { type: Date, default: null } });

  const hideDeleted = function hideDeletedDocs() {
    if (this.getOptions().includeDeleted) return;
    if (this.getFilter().deletedAt === undefined) {
      this.where({ deletedAt: null });
    }
  };

  [
    'find',
    'findOne',
    'findOneAndUpdate',
    'countDocuments',
    'updateOne',
    'updateMany',
  ].forEach((op) => schema.pre(op, hideDeleted));

  schema.pre('aggregate', function hideDeletedInAggregate() {
    if (this.options?.includeDeleted) return;
    this.pipeline().unshift({ $match: { deletedAt: null } });
  });
}
