import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  collection,
} from '@angular/fire/firestore';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule, Location } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { ReactiveFormsModule } from '@angular/forms';
import { EditorModule } from '@tinymce/tinymce-angular';

@Component({
  selector: 'app-questionnaire-form',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, EditorModule],
  templateUrl: './questionnaire-form.component.html',
  styleUrls: ['./questionnaire-form.component.scss'],
})
export class QuestionnaireFormComponent implements OnInit {
  questionnaireForm: FormGroup;
  projectId: string | null = null;
  questionnaireId: string | null = null;
  isEditing: boolean = false;

  tinyMceConfig: any = {
    height: 500,
    menubar: true,
    plugins: [
      'advlist autolink lists link image charmap preview anchor',
      'searchreplace visualblocks code fullscreen insertdatetime media table help wordcount',
    ],
    toolbar:
      'undo redo | formatselect | bold italic backcolor | ' +
      'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | ' +
      'customCheckbox customRadio customTextArea image | removeformat | help',
    external_plugins: {
      print: '/assets/tinymce/plugins/print/plugin.min.js',
      paste: '/assets/tinymce/plugins/paste/plugin.min.js',
    },
    base_url: '/assets/tinymce', // Caminho base para o TinyMCE
    suffix: '.min',
    skin_url: '/assets/tinymce/skins/ui/oxide',
    content_css: '/assets/tinymce/skins/content/default/content.min.css',
    setup: (editor: any) => {
      // Custom Buttons
      editor.ui.registry.addButton('customCheckbox', {
        text: 'Checkbox',
        tooltip: 'Inserir Checkbox',
        onAction: () => {
          editor.insertContent(
            `<label><input type="checkbox" name="checkbox_question"> Opção</label><br>`
          );
        },
      });

      editor.ui.registry.addButton('customRadio', {
        text: 'Radio Button',
        tooltip: 'Inserir Radio Button',
        onAction: () => {
          editor.insertContent(
            `<label><input type="radio" name="radio_question"> Opção</label><br>`
          );
        },
      });

      editor.ui.registry.addButton('customTextArea', {
        text: 'Text Area',
        tooltip: 'Inserir Text Area',
        onAction: () => {
          editor.insertContent(
            `<label>Pergunta:</label><br><textarea rows="4" cols="50" name="text_area_question"></textarea><br>`
          );
        },
      });
    },
  };

  constructor(
    private firestore: Firestore,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private location: Location
  ) {
    this.questionnaireForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      content: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');
    this.questionnaireId = this.route.snapshot.paramMap.get('questionnaireId');

    if (this.questionnaireId) {
      this.isEditing = true;
      this.loadQuestionnaire();
    }
  }

  private async loadQuestionnaire(): Promise<void> {
    try {
      const docRef = doc(
        this.firestore,
        `projects/${this.projectId}/questionnaires/${this.questionnaireId}`
      );
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        this.questionnaireForm.patchValue({
          name: data['name'],
          content: data['content'],
        });
      } else {
        this.snackBar.open('Questionário não encontrado.', 'Fechar', {
          duration: 3000,
        });
        this.router.navigate([`/projects/${this.projectId}/questionnaires`]);
      }
    } catch (error) {
      console.error('Erro ao carregar questionário:', error);
      this.snackBar.open('Erro ao carregar questionário.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async saveQuestionnaire(): Promise<void> {
    if (this.questionnaireForm.invalid) {
      this.snackBar.open('Preencha todos os campos obrigatórios.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    try {
      const data = {
        ...this.questionnaireForm.value,
        createdAt: this.isEditing ? undefined : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const questionnaireId =
        this.questionnaireId ||
        doc(
          collection(
            this.firestore,
            `projects/${this.projectId}/questionnaires`
          )
        ).id;

      const docRef = doc(
        this.firestore,
        `projects/${this.projectId}/questionnaires/${questionnaireId}`
      );
      await setDoc(docRef, data, { merge: true });

      this.snackBar.open(
        `Questionário ${this.isEditing ? 'atualizado' : 'criado'} com sucesso!`,
        'Fechar',
        {
          duration: 3000,
        }
      );

      this.router.navigate([`/projects/${this.projectId}/questionnaires`]);
    } catch (error) {
      console.error('Erro ao salvar questionário:', error);
      this.snackBar.open('Erro ao salvar questionário.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  cancel(): void {
    this.router.navigate([`/projects/${this.projectId}/questionnaires`]);
  }

  goBack(): void {
    this.location.back();
  }
}
