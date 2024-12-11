import { Component } from '@angular/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { TaskDialogComponent } from './task-dialog.component';
import { OkAppTaskComponent } from './ok-task/ok-task.component';
import { DeleteAppTaskComponent } from './delete-task/delete-task.component';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TaskService } from 'src/app/services/apps/taskbord/taskbord-service';
import { Todos } from './taskbord';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgScrollbarModule } from 'ngx-scrollbar';
// tslint:disable-next-line - Disables all

@Component({
  selector: 'app-taskboard',
  templateUrl: './taskboard.component.html',
  styleUrls: ['./taskboard.component.scss'],
  standalone: true,
  imports: [MaterialModule, CommonModule, TablerIconsModule, DragDropModule, NgScrollbarModule],
})
export class AppTaskboardComponent {
  todos: Todos[] = [];
  inprogress: Todos[] = [];
  completed: Todos[] = [];
  onhold: Todos[] = [];

  constructor(
    public dialog: MatDialog,
    public taskService: TaskService,
    private snackBar: MatSnackBar
  ) {
    this.loadTasks();
  }

  loadTasks(): void {
    const allTasks = this.taskService.getAllTasks();

    this.todos = allTasks.todos;
    this.inprogress = allTasks.inProgress;
    this.completed = allTasks.completed;
    this.onhold = allTasks.onHold;
  }

  drop(event: CdkDragDrop<any[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
  }

  openDialog(action: string, obj: any): void {
    obj.action = action;

    const dialogRef = this.dialog.open(TaskDialogComponent, {
      data: obj,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result.event === 'Add') {
        this.taskService.addTask(result.data);
        this.loadTasks();
        this.dialog.open(OkAppTaskComponent);
        this.showSnackbar('Task added successfully!');
      }
      if (result.event === 'Edit') {
        this.taskService.editTask(result.data);
        this.loadTasks();
      }
    });
  }

  deleteTask(t: Todos) {
    const del = this.dialog.open(DeleteAppTaskComponent);

    del.afterClosed().subscribe((result) => {
      if (result === 'true') {
        this.taskService.deleteTask(t.id);
        this.loadTasks();
        this.showSnackbar('Task deleted successfully!');
      }
    });
  }

  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 2000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
  //taskProperty bgcolor
  getTaskClass(taskProperty: string | any): any {
    return taskProperty === 'Design'
      ? 'bg-success'
      : taskProperty === 'Mobile'
      ? 'bg-primary'
      : taskProperty === 'UX Stage'
      ? 'bg-warning'
      : taskProperty === 'Research'
      ? 'bg-error'
      : taskProperty === 'Data Science'
      ? 'bg-accent'
      : taskProperty === 'Branding'
      ? 'bg-primary'
      : '';
  }

  // Method to format date as "DD MMMM"
  formatDate(dateString?: string): string {
    if (!dateString) {
      return '';
    }

    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
    };
    return date.toLocaleDateString('en-US', options);
  }
}
