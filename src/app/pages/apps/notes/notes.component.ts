import { Component, OnInit, signal } from '@angular/core';
import { Note } from './note';
import { NoteService } from 'src/app/services/apps/notes/note.service';
import { CommonModule } from '@angular/common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { MatSnackBar } from '@angular/material/snack-bar';
@Component({
  selector: 'app-notes',
  templateUrl: './notes.component.html',
  styleUrls: ['./notes.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    NgScrollbarModule,
    TablerIconsModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
  ],
})
export class AppNotesComponent implements OnInit {
  sidePanelOpened = signal(true);

  notes = signal<Note[]>([]);

  selectedNote = signal<Note | null>(null);

  active = signal<boolean>(false);

  searchText = signal<any>('');

  clrName = signal<string>('warning');

  colors = [
    { colorName: 'primary' },
    { colorName: 'warning' },
    { colorName: 'accent' },
    { colorName: 'error' },
    { colorName: 'success' },
  ];

  currentNoteTitle = signal<string>('');
  selectedColor = signal<string | null>(null);

  constructor(public noteService: NoteService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.notes.set(this.noteService.getNotes());
    this.selectedNote.set(this.notes()[0]);
    const currentNote = this.selectedNote();
    if (currentNote) {
      this.selectedColor.set(currentNote.color);
      this.clrName.set(currentNote.color);
      this.currentNoteTitle.set(currentNote.title);
    }
  }

  get currentNote(): Note | null {
    return this.selectedNote();
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.notes.set(this.filter(filterValue));
  }

  filter(v: string): Note[] {
    return this.noteService
      .getNotes()
      .filter((x) => x.title.toLowerCase().includes(v.toLowerCase()));
  }

  isOver(): boolean {
    return window.matchMedia(`(max-width: 960px)`).matches;
  }

  onSelect(note: Note): void {
    this.selectedNote.set(note);
    this.clrName.set(note.color);
    this.currentNoteTitle.set(note.title);
    this.selectedColor.set(note.color);
  }

  onSelectColor(colorName: string): void {
    this.clrName.set(colorName);
    this.selectedColor.set(colorName);
    const currentNote = this.selectedNote();
    if (currentNote) {
      currentNote.color = this.clrName();
      this.noteService.updateNote(currentNote);
    }
    this.active.set(!this.active());
  }

  removenote(note: Note): void {
    this.noteService.removeNote(note);
    this.notes.set(this.noteService.getNotes());

    if (this.selectedNote() === note) {
      this.selectedNote.set(null);
      this.currentNoteTitle.set('');
    }
    this.openSnackBar('Note deleted successfully!');
  }

  addNoteClick(): void {
    const newNote: Note = {
      color: this.clrName(),
      title: 'This is a new note',
      datef: new Date(),
    };
    this.noteService.addNote(newNote);
    this.notes.set(this.noteService.getNotes());

    this.openSnackBar('Note added successfully!');
  }

  updateNoteTitle(newTitle: string): void {
    const currentNote = this.selectedNote();
    if (currentNote) {
      currentNote.title = newTitle;
      this.noteService.updateNote(currentNote);
      this.notes.set(this.noteService.getNotes());
    }
  }

  openSnackBar(
    message: string,
    action: string = 'Close',
    type: 'create' | 'delete' = 'create'
  ): void {
    this.snackBar.open(message, action, {
      duration: 2000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
