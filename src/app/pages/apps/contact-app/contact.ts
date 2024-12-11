export class ContactBox {
    constructor(
    public id: number | string,
    public firstname: string,
    public  lastname: string,
    public image: string,
    public department: string,
    public company: string,
    public phone: string,
    public email: string,
    public address: string,
    public notes: string,
    public frequentlycontacted: boolean,
    public starred: boolean,
    public deleted: boolean,
    ){}
  }
