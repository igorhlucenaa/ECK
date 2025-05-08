declare module 'pdfmake/build/pdfmake' {
  import { TDocumentDefinitions } from 'pdfmake/interfaces';

  const pdfMake: {
    vfs: { [file: string]: string };
    createPdf: (documentDefinition: TDocumentDefinitions) => {
      download: (defaultFileName?: string) => void;
    };
  };

  export default pdfMake;
}

declare module 'pdfmake/build/vfs_fonts' {
  const fonts: {
    pdfMake: {
      vfs: { [file: string]: string };
    };
  };
  export default fonts;
}
