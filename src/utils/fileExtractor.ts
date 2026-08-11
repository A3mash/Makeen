import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

// Use a bundler-friendly worker URL so Vite/webpack resolve the asset correctly
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.js',
  import.meta.url
).toString();

export async function extractTextFromFile(file: File): Promise<string> {
  // Normalize name check and type check for PDFs
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => (item && (item.str ?? item.toString())) || '')
          .join(' ');
        fullText += pageText + '\n';
      }

      if (!fullText.trim()) {
        throw new Error('لم يتم العثور على أي نص داخل ملف الـ PDF. قد يكون عبارة عن صور ممسوحة ضوئياً.');
      }

      return fullText;
    } catch (error: any) {
      console.error('PDF Extraction Error:', error);
      // Preserve the original error message if available
      throw new Error(`فشل استخراج النص من الـ PDF: ${error?.message ?? String(error)}`);
    }
  }

  // Fallback: try reading as text for common text-like files, otherwise return a clear message
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else if (result instanceof ArrayBuffer) {
        // Attempt to decode ArrayBuffer as UTF-8 text
        try {
          const decoder = new TextDecoder('utf-8');
          resolve(decoder.decode(result));
        } catch (e) {
          resolve('محتوى غير مدعوم أو فارغ.');
        }
      } else {
        resolve('محتوى غير مدعوم أو فارغ.');
      }
    };

    reader.onerror = (error) => {
      console.error('File reading error:', error);
      reject(new Error('حدث خطأ أثناء قراءة الملف.'));
    };

    if (file.type === 'text/plain' || file.name.match(/\.(txt|md|csv|json)$/i)) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}
