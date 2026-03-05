export interface Assessment {
  id: string;
  createdBy: {
    role: string;
    name: string;
    email: string;
  };
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
  description: string;
  surveyJSON: any; // O JSON que contém os dados do survey
  name: string;
  clientId: string;
}
