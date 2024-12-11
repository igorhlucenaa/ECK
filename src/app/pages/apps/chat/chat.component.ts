import { Component, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { ChatService } from 'src/app/services/apps/chat/chat.service';
import { Message } from 'src/app/pages/apps/chat/chat';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    NgScrollbarModule,
    TablerIconsModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
  ],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class AppChatComponent {
  sidePanelOpened = true; 
  //input feild for  new msg
  msg = signal('');

  // MESSAGE
  selectedMessage = signal<Message | null>(null);

  messages = signal<Message[]>([]);

  filteredMessages = signal<Message[]>([]);

  searchTerm = signal('');

  // tslint:disable-next-line - Disables all

  constructor(private chatService: ChatService) {}
  ngOnInit() {
    this.messages.set(this.chatService.messages());

    this.filteredMessages.set(this.messages());
    this.selectedMessage.set(this.chatService.selectedMessage());
  }

  isOver(): boolean {
    return window.matchMedia(`(max-width: 960px)`).matches;
  }

  // tslint:disable-next-line - Disables all
  selectMessage(message: Message): void {
    this.selectedMessage.set(message);

    if (this.isOver()) { // Check if the screen is small
      this.sidePanelOpened = false; // Close the sidebar
    }
  }

  sendMessage(): void {
    const currentSelectedMessage = this.selectedMessage();
    if (currentSelectedMessage) {
      this.chatService.sendMessage(currentSelectedMessage, this.msg());
      this.msg.set('');
    }
  }

  searchMessages(): void {
    this.filteredMessages.set(
      this.searchTerm().trim()
        ? this.messages().filter((message) =>
            message.from.toLowerCase().includes(this.searchTerm().toLowerCase())
          )
        : this.messages()
    );
  }
}
