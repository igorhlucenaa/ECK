import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  constructor(private dialog: MatDialog) {}

  /**
   * Abre diálogo de confirmação de exclusão.
   * @param itemName  Nome do item que será excluído (exibido em destaque).
   * @param message   Mensagem adicional opcional (ex: "Isso removerá todos os vínculos.").
   * @returns true se o usuário confirmou, false/undefined caso contrário.
   */
  async confirmDelete(itemName: string, message?: string): Promise<boolean> {
    const data: ConfirmDialogData = {
      type: 'danger',
      title: 'Confirmar exclusão',
      itemName,
      message,
    };
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      disableClose: true,
      panelClass: 'confirm-dialog-panel',
      data,
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  /**
   * Abre diálogo de confirmação genérico.
   */
  async confirm(data: ConfirmDialogData): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      disableClose: true,
      panelClass: 'confirm-dialog-panel',
      data,
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
