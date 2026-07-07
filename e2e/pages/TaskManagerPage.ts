import { type Locator, type Page, expect } from '@playwright/test';

export class TaskManagerPage {
  readonly page: Page;
  readonly titleInput: Locator;
  readonly addButton: Locator;
  readonly taskList: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.titleInput = page.getByPlaceholder('Add a new task...');
    this.addButton = page.getByRole('button', { name: 'Add' });
    this.taskList = page.locator('.task-list');
    this.errorMessage = page.locator('.error');
  }

  async goto() {
    await this.page.goto('/');
  }

  async addTask(title: string) {
    await this.titleInput.fill(title);
    await this.addButton.click();
  }

  taskItem(title: string): Locator {
    return this.taskList.locator('li', { hasText: title });
  }

  async toggleTask(title: string) {
    await this.taskItem(title).locator('span').click();
  }

  async deleteTask(title: string) {
    await this.taskItem(title).getByRole('button', { name: 'Delete' }).click();
  }

  async expectTaskVisible(title: string) {
    await expect(this.taskItem(title)).toBeVisible();
  }

  async expectTaskHidden(title: string) {
    await expect(this.taskItem(title)).toHaveCount(0);
  }

  async expectTaskCompleted(title: string) {
    await expect(this.taskItem(title)).toHaveClass(/completed/);
  }
}
