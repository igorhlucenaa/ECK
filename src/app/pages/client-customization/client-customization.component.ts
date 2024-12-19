import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { CoreService } from 'src/app/services/core.service';

@Component({
  selector: 'app-client-customization',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule, CommonModule],
  templateUrl: './client-customization.component.html',
  styleUrls: ['./client-customization.component.scss'],
})
export class ClientCustomizationComponent implements OnInit {
  customizationForm: FormGroup;
  clientId: string | null = null;
  logoPreview: string | null = null;
  selectedColor: string = '#000000';
  selectedPrimaryColor = '#1B84FF';

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private firestore: Firestore,
    private route: ActivatedRoute,
    private router: Router,
    private coreService: CoreService // Importa CoreService
  ) {
    this.customizationForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      logo: [null],
      themeColor: [this.selectedColor, Validators.required], // Cor única
    });
  }

  ngOnInit(): void {
    this.applySavedTheme();

    this.clientId = this.route.snapshot.paramMap.get('id');
    if (this.clientId) {
      this.loadClientData();
    }
  }

  private applySavedTheme(): void {
    const savedColor = localStorage.getItem('userThemeColor'); // Substitua por um valor do Firestore
    if (savedColor) {
      this.selectedColor = savedColor;
      this.coreService.setDynamicTheme(savedColor);
    }
  }

  private async loadClientData(): Promise<void> {
    try {
      const clientDoc = doc(this.firestore, `clients/${this.clientId}`);
      const clientSnap = await getDoc(clientDoc);
      if (clientSnap.exists()) {
        const data = clientSnap.data();
        this.customizationForm.patchValue({
          name: data['name'],
          logo: data['logo'],
          themeColor: data['themeColor'] || '#000000',
        });
        this.logoPreview = data['logo'];
        this.selectedColor = data['themeColor'] || '#000000';
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.snackBar.open('Erro ao carregar dados do cliente.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  onFileChange(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.logoPreview = reader.result as string;
        this.customizationForm.patchValue({ logo: this.logoPreview });
      };
      reader.readAsDataURL(file);
    }
  }

  updatePrimaryColor(color: string): void {
    this.selectedColor = color;
    document.documentElement.style.setProperty('--primary-color', color);
    document.documentElement.style.setProperty(
      '--primary-color-light',
      this.lightenColor(color, 40)
    );
    document.documentElement.style.setProperty(
      '--primary-color-dark',
      this.darkenColor(color, 20)
    );
  }

  private lightenColor(color: string, percent: number): string {
    // Função para clarear a cor
    // Implementação simples para manipular cores
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return `#${(
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)}`;
  }

  private darkenColor(color: string, percent: number): string {
    // Função para escurecer a cor
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;
    return `#${(
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)}`;
  }

  // Métodos auxiliares para gerar cores complementares (opcional)
  generateAccentColor(baseColor: string): string {
    // Retorna uma cor baseada no baseColor (exemplo, mais clara/escura)
    return '#ff4081'; // Cor fixa ou lógica para gerar
  }

  generateWarnColor(baseColor: string): string {
    // Retorna uma cor baseada no baseColor (exemplo, mais clara/escura)
    return '#f44336'; // Cor fixa ou lógica para gerar
  }

  async saveCustomization(): Promise<void> {
    if (this.customizationForm.invalid) {
      this.snackBar.open('Preencha todos os campos obrigatórios.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    try {
      const clientDoc = doc(this.firestore, `clients/${this.clientId}`);
      await setDoc(
        clientDoc,
        {
          ...this.customizationForm.value,
          themeColor: this.selectedColor, // Salva a cor selecionada
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      this.snackBar.open('Dados salvos com sucesso!', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      this.snackBar.open('Erro ao salvar dados.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/starter']);
  }
}
