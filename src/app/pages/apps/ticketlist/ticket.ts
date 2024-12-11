export interface TicketElement {
  id: number;
  title: string;
  subtext: string;
  assignee: string;
  imgSrc: string;
  status: string;
  date: string;
  action?: string;
}
