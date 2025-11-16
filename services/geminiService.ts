
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
  type: Type.OBJECT,
  properties: {
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
  required: ["overallStatus", "summary", "details"]
};


export const validateInvoiceWithAI = async (invoiceJson: object): Promise<ValidationResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Eres un experto en la normativa aduanera de la DIAN en Colombia, especializado en la validación de facturas comerciales de importación.
    Tu tarea es analizar la siguiente factura (en formato JSON) y verificar si cumple con los requisitos legales detallados en la cartilla oficial "Factura comercial en la determinación del valor en aduana de las mercancías importadas" (CT-COA-0124).

    **Requisitos Legales Detallados (Basados en Cartilla CT-COA-0124):**
    ${DIAN_REQUIREMENTS_FULL}

    **Instrucciones de Análisis Avanzado:**
    1.  Analiza exhaustivamente el JSON de la factura proporcionado.
    2.  Compara los datos de la factura contra cada uno de los 14 requisitos listados.
    3.  **Realiza validaciones cruzadas**:
        *   **Cálculos Internos**: Si aplica, verifica que el precio total de un ítem coincida con cantidad * precio unitario. Verifica que el total de la factura sea coherente con la suma de los subtotales.
        *   **Consistencia de Campos**: Valida la coherencia entre el Incoterm y los gastos de flete/seguro declarados.
    4.  Determina el estado de cada requisito: 'PASS', 'FAIL', o 'PARTIAL', prestando especial atención a las condiciones de cumplimiento parcial.
    5.  Para cada requisito, proporciona una **razón** clara, técnica y concisa en español del porqué del estado. Si es PASS, indica brevemente qué dato se validó exitosamente. Si es FAIL o PARTIAL, explica la discrepancia específica.
    6.  Para estados FAIL o PARTIAL, proporciona una **sugerencia** de corrección clara y accionable. Si el estado es PASS, la sugerencia debe ser un texto vacío ('').
    7.  Para cada requisito, completa el campo **dianRule** con el texto "Referencia DIAN: Requisito X", donde X es el número del ID del requisito.
    8.  El **overallStatus** debe ser 'COMPLIANT' solo si TODOS los requisitos tienen estado 'PASS'. En cualquier otro caso (al menos un FAIL o PARTIAL), debe ser 'NON_COMPLIANT'.
    9.  Genera un **summary** conciso en español (máximo 25 palabras) que refleje el resultado general, indicando si hay incumplimientos críticos o parciales.
    10. Responde ÚNICAMENTE con un objeto JSON que se ajuste al esquema definido. No incluyas texto, explicaciones o markdown fuera del objeto JSON.

    **Factura a Analizar:**
    \`\`\`json
    ${JSON.stringify(invoiceJson, null, 2)}
    \`\`\`

    Ahora, proporciona tu análisis detallado en el formato JSON especificado.
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
    const result = JSON.parse(jsonText);
    
    // Ensure all details are present as per the enum
    result.details.forEach((detail: any) => {
        if (!Object.values(ValidationStatus).includes(detail.status)) {
            console.warn(`Invalid status found: ${detail.status}. Defaulting to FAIL.`);
            detail.status = ValidationStatus.FAIL;
        }
    });

    return result as ValidationResult;

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("La IA no pudo procesar la solicitud. Inténtalo de nuevo más tarde.");
  }
};
