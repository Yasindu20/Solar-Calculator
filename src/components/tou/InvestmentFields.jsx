import { batteryDefaults } from '../../config/tariffs.js';
import { rs } from '../../lib/format.js';
import { NumberField } from '../NumberField.jsx';

export function InvestmentFields({ values, results: r, setCost, setFinance }) {
  const batteryOn = values.battery.on;
  return (
    <>
      <NumberField
        label="Solar system cost"
        prefix="Rs."
        value={values.costs.solar}
        onChange={setCost('solar')}
        hint="Panels, inverters and installation"
      />
      {batteryOn && (
        <NumberField
          label="Battery system cost"
          prefix="Rs."
          value={values.costs.battery}
          onChange={setCost('battery')}
          hint={`Estimated at ${rs(batteryDefaults.pricePerKwh)} per kWh with its inverter. Type the quoted price.`}
        />
      )}
      {values.engineering && (
        <NumberField
          label="Other costs"
          optional
          prefix="Rs."
          value={values.costs.other}
          onChange={setCost('other')}
          hint="Transformer, civil works, approvals"
        />
      )}

      <div className="total-row" aria-live="polite">
        <span>Total investment</span>
        <strong>{rs(r.investment)}</strong>
      </div>

      {values.engineering && (
        <div className="engineering">
          <p className="engineering-title">Running costs and ageing</p>
          <div className="field-pair field-pair-even">
            <NumberField
              label="Yearly maintenance"
              suffix="%"
              decimals="auto"
              value={values.finance.maintenance}
              onChange={setFinance('maintenance')}
              hint={`Of the investment: ${rs(r.maintenance)} a year`}
            />
            <NumberField
              label="Discount rate"
              suffix="%"
              decimals="auto"
              value={values.finance.discount}
              onChange={setFinance('discount')}
              hint="For the net present value"
            />
          </div>
          <div className="field-pair field-pair-even">
            <NumberField
              label="Panel output loss"
              suffix="% a year"
              decimals="auto"
              value={values.finance.solarLoss}
              onChange={setFinance('solarLoss')}
            />
            {batteryOn && (
              <NumberField
                label="Battery capacity loss"
                suffix="% a year"
                decimals="auto"
                value={values.finance.batteryLoss}
                onChange={setFinance('batteryLoss')}
              />
            )}
          </div>
          {batteryOn && (
            <div className="field-pair field-pair-even">
              <NumberField
                label="Battery life"
                suffix="years"
                decimals="auto"
                value={values.finance.batteryLife}
                onChange={setFinance('batteryLife')}
                hint="Replaced after this"
              />
              <NumberField
                label="Replacement cost"
                suffix="%"
                decimals="auto"
                value={values.finance.replacement}
                onChange={setFinance('replacement')}
                hint="Of today’s battery price"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
