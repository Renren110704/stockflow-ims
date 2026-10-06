import Location from '../models/Location.js';
import StockLevel from '../models/StockLevel.js';

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

// Units of `productId` currently allocated to specific locations.
export async function getAllocatedQuantity(productId, session) {
  const rows = await StockLevel.find({ product: productId }).session(session);
  return rows.reduce((sum, row) => sum + row.quantity, 0);
}

async function assertLocationExists(locationId, session) {
  const location = await Location.findById(locationId).session(session);
  if (!location) throw httpError('Location not found', 404);
  return location;
}

async function addToLevel(productId, locationId, qty, session) {
  await StockLevel.findOneAndUpdate(
    { product: productId, location: locationId },
    { $inc: { quantity: qty } },
    { upsert: true, new: true, setDefaultsOnInsert: true, session }
  );
}

// Applies a STOCK_IN / STOCK_OUT to `product` (a mongoose document loaded
// inside `session`) and, when a location is given, to that location's
// stock level. Saves the product so its derived status hook runs.
// Throws errors carrying `statusCode` for the caller to translate.
export async function applyMovement({ product, type, qty, locationId, session }) {
  if (locationId) await assertLocationExists(locationId, session);

  if (type === 'STOCK_OUT') {
    if (locationId) {
      const level = await StockLevel.findOne({ product: product._id, location: locationId }).session(session);
      const available = level?.quantity || 0;
      if (available < qty) {
        throw httpError(`Insufficient stock at that location: only ${available} unit(s) available`, 409);
      }
      level.quantity -= qty;
      await level.save({ session });
    } else {
      const allocated = await getAllocatedQuantity(product._id, session);
      const available = product.quantity - allocated;
      if (available < qty) {
        throw httpError(
          allocated === 0
            ? `Insufficient stock: only ${product.quantity} unit(s) available`
            : `Only ${Math.max(available, 0)} unit(s) are not assigned to a location — choose a location for this stock out`,
          409
        );
      }
    }
    product.quantity -= qty;
  } else {
    if (locationId) await addToLevel(product._id, locationId, qty, session);
    product.quantity += qty;
  }

  await product.save({ session });
}

// Moves stock between locations. The product's total quantity is
// unchanged: null on either side means "unassigned" stock.
export async function applyTransfer({ product, qty, fromId, toId, session }) {
  if (String(fromId || '') === String(toId || '')) {
    throw httpError('Source and destination must be different', 422);
  }
  if (fromId) await assertLocationExists(fromId, session);
  if (toId) await assertLocationExists(toId, session);

  if (fromId) {
    const level = await StockLevel.findOne({ product: product._id, location: fromId }).session(session);
    const available = level?.quantity || 0;
    if (available < qty) {
      throw httpError(`Only ${available} unit(s) available at the source location`, 409);
    }
    level.quantity -= qty;
    await level.save({ session });
  } else {
    const allocated = await getAllocatedQuantity(product._id, session);
    const unassigned = product.quantity - allocated;
    if (unassigned < qty) {
      throw httpError(`Only ${Math.max(unassigned, 0)} unassigned unit(s) available`, 409);
    }
  }

  if (toId) await addToLevel(product._id, toId, qty, session);
}
