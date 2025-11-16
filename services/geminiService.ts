
import { GoogleGenAI, Type } from "@google/genai";
import { ValidationResult, ValidationStatus } from '../types';

const DIAN_REQUIREMENTS_FULL = `
Basado en la Cartilla de Factura Comercial CT-COA-0124 de la DIAN, los requisitos son:

1.  **Número de factura**:
    *   **Verificación**: Debe estar presente y ser único.
    *   **Cumplimiento Parcial**: No.

2.  **Fecha de expedición**:
    *   **Verificación**: Debe ser una fecha clara y válida (formato reconocible).
    *   **Cumplimiento Parcial**: Sí (ej. formato incorrecto pero interpretable, falta el día).

3.  **Lugar de expedición**:
    *   **Verificación**: Debe indicar la ciudad y país de emisión, correspondiendo al domicilio fiscal del vendedor.
    *   **Cumplimiento Parcial**: Sí (si falta ciudad o país).

4.  **Nombre y dirección del vendedor**:
    *   **Verificación**: Debe contener la información completa (nombre/razón social, dirección completa).
    *   **Cumplimiento Parcial**: Sí (ej. nombre sin dirección).

5.  **Nombre y dirección del comprador**:
    *   **Verificación**: Debe contener la información completa (nombre/razón social, dirección completa).
    *   **Cumplimiento Parcial**: Sí (ej. falta ciudad o país).

6.  **Descripción detallada de la mercancía**:
    *   **Verificación**: La descripción debe ser específica y no genérica para permitir la clasificación arancelaria.
    *   **Cumplimiento Parcial**: Sí (si hay texto, pero es muy vago o genérico).

7.  **Cantidad de unidades**:
    *   **Verificación**: Debe indicar la cantidad de items. Debe ser coherente con el precio unitario y total.
    *   **Cumplimiento Parcial**: Sí (si la cantidad no cuadra con el total, pero ambos valores existen).

8.  **Precio unitario y total**:
    *   **Verificación**: Deben estar claramente discriminados para cada ítem, así como el valor total de la factura.
    *   **Cumplimiento Parcial**: Sí (si solo uno de los dos precios está presente por ítem).

9.  **Moneda de la transacción**:
    *   **Verificación**: Debe estar explícitamente indicada (ej. USD, EUR).
    *   **Cumplimiento Parcial**: No.

10. **Condiciones de entrega (Incoterm)**:
    *   **Verificación**: Debe incluir un Incoterm válido según la ICC (ej. FOB, CIF, EXW).
    *   **Cumplimiento Parcial**: No.

11. **Forma de pago**:
    *   **Verificación**: Debe poder determinarse a partir del documento, aunque no esté explícita (ej. plazos de pago, datos bancarios).
    *   **Cumplimiento Parcial**: Sí (si hay indicios, pero no está claro).

12. **Originalidad y validez**:
    *   **Verificación**: El documento no debe indicar ser "Proforma", "Borrador" (Draft) ni tener tachones o enmendaduras visibles.
    *   **Cumplimiento Parcial**: No.

13. **Inclusión de gastos adicionales (Flete, Seguro)**:
    *   **Verificación**: Analizar la consistencia entre el Incoterm y los gastos listados. Si es CIF, el flete y seguro deben estar incluidos o soportados. Si es FOB, no deberían estar en el valor de la mercancía.
    *   **Cumplimiento Parcial**: Sí (si se mencionan gastos pero sin detallar el valor).

14. **Comisiones o descuentos aplicados**:
    *   **Verificación**: Si existen, deben estar discriminados, indicando su concepto y cuantía. Los descuentos no deben ser retroactivos.
    *   **Cumplimiento Parcial**: Sí (si se indica que hay un descuento pero no se justifica o cuantifica claramente).
`;

const responseSchema = {
  type: Type.ARRAY,
  description: "Un array de resultados de validación, uno por cada factura en el lote de entrada.",
  items: {
    type: Type.OBJECT,
    properties: {
      invoiceId: {
        type: Type.STRING,
        description: "El número de factura, extraído del campo 'numero_factura' del JSON de la factura."
      },
      overallStatus: {
        type: Type.STRING,
        enum: ['COMPLIANT', 'NON_COMPLIANT'],
        description: "El estado general de la factura. 'COMPLIANT' si todos los chequeos son PASS, de lo contrario 'NON_COMPLIANT'."
      },
      summary: {
        type: Type.STRING,
        description: "Un resumen conciso en español (máximo 25 palabras) sobre el resultado de la validación."
      },
      details: {
        type: Type.ARRAY,
        description: "Una lista de los resultados de la validación para cada requisito de la DIAN.",
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER, description: "El número del requisito, del 1 al 14." },
            requirement: { type: Type.STRING, description: "El nombre del requisito validado." },
            dianRule: { type: Type.STRING, description: "La referencia a la norma o requisito DIAN aplicable. Ej: 'Referencia DIAN: Requisito 1'." },
            status: { 
              type: Type.STRING, 
              enum: ['PASS', 'FAIL', 'PARTIAL'],
              description: "PASS (cumple), FAIL (no cumple), o PARTIAL (cumple parcialmente)."
            },
            reason: { 
              type: Type.STRING, 
              description: "Una explicación clara y concisa en español del porqué del estado. Si es PASS, indica brevemente qué dato se validó."
            },
            suggestion: {
              type: Type.STRING,
              description: "Una acción sugerida y clara en español para corregir el problema si el estado es FAIL o PARTIAL. Si es PASS, debe ser un texto vacío ''."
            }
          },
          required: ["id", "requirement", "dianRule", "status", "reason", "suggestion"]
        }
      }
    },
    required: ["invoiceId", "overallStatus", "summary", "details"]
  }
};

export const validateInvoicesWithAI = async (invoices: object[]): Promise<ValidationResult[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Eres un experto en la normativa aduanera de la DIAN en Colombia, especializado en la validación de facturas comerciales de importación.
    Tu tarea es analizar el siguiente LOTE de facturas (proporcionado como un array de objetos JSON) y verificar si cada una cumple con los requisitos legales detallados en la cartilla oficial "Factura comercial en la determinación del valor en aduana de las mercancías importadas" (CT-COA-0124).

    **Requisitos Legales Detallados (Basados en Cartilla CT-COA-0124):**
    ${DIAN_REQUIREMENTS_FULL}

    **Instrucciones de Análisis de Lote:**
    1.  Procesa el array de facturas JSON proporcionado. Para CADA factura en el array, realiza las siguientes acciones.
    2.  **Extrae el Identificador**: Obtén el número de factura del campo 'numero_factura' (o similar). Este será el 'invoiceId'. Si no encuentras un número, usa 'Factura sin ID ' seguido del índice en el array (ej. 'Factura sin ID 0').
    3.  **Análisis Exhaustivo por Factura**: Compara los datos de la factura contra cada uno de los 14 requisitos listados.
    4.  **Realiza validaciones cruzadas por Factura**:
        *   **Cálculos Internos**: Verifica que el precio total de un ítem coincida con cantidad * precio unitario.
        *   **Consistencia de Campos**: Valida la coherencia entre el Incoterm y los gastos de flete/seguro declarados.
    5.  Para cada requisito de cada factura, determina el estado ('PASS', 'FAIL', 'PARTIAL'), proporciona una **razón** clara y una **sugerencia** accionable si es necesario. Completa el campo **dianRule** con "Referencia DIAN: Requisito X".
    6.  El **overallStatus** de una factura debe ser 'COMPLIANT' solo si TODOS sus requisitos tienen estado 'PASS'. En cualquier otro caso, debe ser 'NON_COMPLIANT'.
    7.  Genera un **summary** conciso para cada factura.
    8.  **Formato de Salida Final**: Tu respuesta DEBE ser un único array JSON. Cada elemento del array será un objeto que representa el análisis completo de una de las facturas del lote de entrada, ajustándose estrictamente al esquema definido. No incluyas texto, explicaciones o markdown fuera de este array JSON.

    **Lote de Facturas a Analizar:**
    \`\`\`json
    ${JSON.stringify(invoices, null, 2)}
    \`\`\`

    Ahora, proporciona tu análisis detallado en el formato de array JSON especificado.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
      },
    });

    const jsonText = response.text.trim();
    const results = JSON.parse(jsonText);
    
    // Data integrity check
    results.forEach((result: any) => {
        result.details.forEach((detail: any) => {
            if (!Object.values(ValidationStatus).includes(detail.status)) {
                console.warn(`Invalid status found: ${detail.status} for invoice ${result.invoiceId}. Defaulting to FAIL.`);
                detail.status = ValidationStatus.FAIL;
            }
        });
    });

    return results as ValidationResult[];

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("La IA no pudo procesar la solicitud para el lote de facturas. Inténtalo de nuevo más tarde.");
  }
};
