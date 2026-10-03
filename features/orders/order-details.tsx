import { money } from '@/lib/money';
import type { Order } from './types';
export function OrderDetails({ order }: { order: Order }) {
  return (
    <>
      <div className="notice-box">
        <p>
          <strong>{order.number}</strong>
        </p>
        <p>
          Order: {order.status} · Payment: {order.payment_status} · Fulfilment:{' '}
          {order.fulfilment_status}
        </p>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <caption className="sr-only">Items in your order</caption>
          <thead>
            <tr>
              <th>Piece</th>
              <th>Quantity</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((l) => (
              <tr key={l.variant_id}>
                <td>
                  {l.name}
                  <p className="caption">{Object.values(l.attributes).join(' / ')}</p>
                </td>
                <td>{l.quantity}</td>
                <td>{money(l.price * l.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="total-row">
        <span>Delivery</span>
        <span>{money(order.delivery)}</span>
      </div>
      <div className="total-row">
        <strong>Order total</strong>
        <strong>{money(order.total)}</strong>
      </div>
      <h2 style={{ fontSize: 28, marginTop: 30 }}>Delivery details</h2>
      <p>
        {order.contact.firstName} {order.contact.lastName}
        <br />
        {order.contact.address}
        <br />
        {order.contact.city}, {order.contact.state}
      </p>
    </>
  );
}
