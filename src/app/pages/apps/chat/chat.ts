export interface Message {
    id: string;
    from: string;
    subject: string;
    photo: string;
    chat: { type: string; msg: string; date: Date }[];
  }