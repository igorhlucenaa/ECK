// Declaração de tipos para PDFMake (carregamento dinâmico)
declare module 'pdfmake/build/pdfmake' {
  const pdfMake: any;
  export default pdfMake;
  export = pdfMake;
}

declare module 'pdfmake/build/vfs_fonts' {
  const pdfFonts: any;
  export default pdfFonts;
  export = pdfFonts;
}
