'use client';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Field } from '@/components/ui/field';
import type { EditableVariant } from './product-editor';
export function VariantEditor({
  variants,
  setVariants,
  images,
}: {
  variants: EditableVariant[];
  setVariants: Dispatch<SetStateAction<EditableVariant[]>>;
  images: { url: string; alt: string }[];
}) {
  const [optionName, setOptionName] = useState('Size');
  const [optionValues, setOptionValues] = useState('S, M, L');
  const [colour, setColour] = useState('');
  function update(index: number, key: string, value: unknown) {
    setVariants((current) => current.map((v, i) => (i === index ? { ...v, [key]: value } : v)));
  }
  return (
    <fieldset>
      <legend>03 / Options & inventory</legend>
      <p className="caption">
        Each sellable combination has its own SKU and stock. Existing variants can be deactivated;
        historical order references are retained.
      </p>
      <p className="caption">
        Upload a photograph for each colour, then assign it to the matching variants below. The
        colour linked to the primary photograph is selected when customers open the product.
      </p>
      <div className="form-grid" style={{ marginTop: 15 }}>
        <Field id="option-name" label="Option name">
          <input
            id="option-name"
            value={optionName}
            onChange={(e) => setOptionName(e.target.value)}
          />
        </Field>
        <Field id="option-values" label="Values (comma separated)">
          <input
            id="option-values"
            value={optionValues}
            onChange={(e) => setOptionValues(e.target.value)}
          />
        </Field>
        <Field id="option-colour" label="Colour (optional)">
          <input id="option-colour" value={colour} onChange={(e) => setColour(e.target.value)} />
        </Field>
        <button
          type="button"
          className="small-button"
          onClick={() => {
            const values = optionValues
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            if (!optionName.trim() || !values.length) return;
            setVariants((v) => [
              ...v,
              ...values
                .filter(
                  (value) =>
                    !v.some(
                      (x) =>
                        x.attributes[optionName] === value &&
                        (!colour || x.attributes.Colour === colour),
                    ),
                )
                .map((value, i) => ({
                  sku: `SKU-${Date.now()}-${i}`,
                  attributes: { [optionName]: value, ...(colour ? { Colour: colour } : {}) },
                  stock: 0,
                  price: null,
                  active: true,
                })),
            ]);
          }}
        >
          Generate variants
        </button>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Variant</th>
              <th>SKU</th>
              <th>Stock</th>
              <th>Price override (₦)</th>
              <th>Photograph</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v, i) => (
              <tr key={v.id || i}>
                <td>
                  {Object.entries(v.attributes)
                    .map(([k, val]) => `${k}: ${val}`)
                    .join(' / ')}
                </td>
                <td>
                  <input
                    aria-label={`SKU for variant ${i + 1}`}
                    value={v.sku}
                    onChange={(e) => update(i, 'sku', e.target.value)}
                    style={{ width: 130 }}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Stock for variant ${i + 1}`}
                    type="number"
                    min="0"
                    value={v.stock}
                    onChange={(e) => update(i, 'stock', Number(e.target.value))}
                    style={{ width: 65 }}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Price for variant ${i + 1}`}
                    type="number"
                    min="0"
                    step=".01"
                    value={v.price === null ? '' : v.price / 100}
                    onChange={(e) =>
                      update(
                        i,
                        'price',
                        e.target.value === '' ? null : Math.round(Number(e.target.value) * 100),
                      )
                    }
                    style={{ width: 100 }}
                  />
                </td>
                <td>
                  <select
                    aria-label={`Photograph for variant ${i + 1}`}
                    value={v.image || ''}
                    onChange={(e) => update(i, 'image', e.target.value || null)}
                    style={{ maxWidth: 190 }}
                  >
                    <option value="">Not assigned</option>
                    {images.map((image, index) => (
                      <option key={image.url} value={image.url}>
                        {`Image ${index + 1}${index === 0 ? ' (primary)' : ''}: ${image.alt || 'Product photograph'}`}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    aria-label={`Active variant ${i + 1}`}
                    type="checkbox"
                    checked={v.active}
                    onChange={(e) => update(i, 'active', e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}
