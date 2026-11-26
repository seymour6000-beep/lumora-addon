# Harbourline POS

A **simulated** gas station point of sale, modelled on what Canadian fuel retailers run: pumps, store sales, loyalty points,
pay-at-the-pump, a phone app and a back office. It runs as its own Home Assistant app beside Lumora. It has its own port, its own data
and its own updates, and it never touches Lumora.

> Simulation only: card payments, pumps and the phone app's cards are pretend. No real card numbers are taken or stored.
> To take real money you would need a certified payment terminal and processor plus a real pump controller.

## Pages

| Address | What it is |
| --- | --- |
| `http://<your-server>:8090/` | Cashier screen, journal and back office |
| `http://<your-server>:8090/forecourt` | Forecourt simulator: you play the customers at the pumps |
| `http://<your-server>:8090/app` | Customer phone app (Harbour Points, pay for fuel, receipts) |

The first visit asks you to create the **owner** account.

## Daily flow

1. **Open your shift**: tap the shift chip and count your float. You can't sell until the shift is open.
2. **Sell**: tap item keys or scan a barcode, add a member with their phone number, then pay with cash, a card (simulated terminal), a gift card or points.
   You can split a payment across several of these. Age-restricted items (19+ by default) ask you to check ID first.
3. **Pumps** (left side, live):
   - **Prepay**: tap a free pump, choose Prepay and an amount, then take payment. The pump unlocks. If the customer pumps less, the pump turns
     purple and shows *Change due*. Tap it to refund the difference the way they paid.
   - **Pay after (postpay)**: tap a free pump, choose Authorize. When they hang up, the pump turns red. Tap it and choose *Add to sale*.
   - **Pay at pump / app**: customers do it themselves. The sale is recorded automatically and shows in the journal.
   - **Stop all pumps** is the emergency stop.
4. **Refunds**: open the receipt from the Journal and choose Refund. Cashiers need a manager's username and PIN. Money goes back to the original
   payment, stock is put back and points are reversed. Gift card sales are final, and prepaid fuel is settled with *Change due* instead.
5. **Close your shift**: count the drawer. You'll see expected cash vs counted (over or short). Safe drops and paid outs are in the shift menu.

## Harbour Points (loyalty)

- Earn points per litre and per $1 in store, and redeem them in whole dollars (defaults: 10 per litre, 10 per $1, 1,000 points = $1).
- **Fuel saver**: give a member a cents-per-litre discount in Back office > Members. It applies automatically whenever they're attached.
- Members created at the counter can join the app with the same phone number and keep their points.

## Back office (managers and owner)

Dashboard (day totals, fuel by grade, payment mix, top items, sales by hour, counter vs pump vs app), fuel prices, items and stock
(barcodes, HST on/off, age-restricted, car wash codes), members, gift cards, staff and roles, shifts with over/short, settings and an activity log.

Roles: **cashier** sells; **manager** also does refunds, prices, items, reports and cashiers; **owner** does everything, including roles.

## Settings worth knowing

- **HST rate**: 14% by default (Nova Scotia). Fuel prices include tax; store items add it.
- **Simulation speed**: makes pumps fill faster for testing (1 = real time, default 4).
- **Number of pumps**: 1 to 24.

## Data

Everything is kept in the app's own `/data/pos.json`, with daily backups in `/data/backups` (the last 14 days).
Lumora's data is separate and untouched.

## Running it on its own (for development)

```
cd pos
node server.js            # http://localhost:8090, data in pos/data
npm test                  # end-to-end tests
```
