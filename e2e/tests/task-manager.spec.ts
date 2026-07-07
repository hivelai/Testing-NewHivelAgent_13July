import { test, expect } from '@playwright/test';
import { TaskManagerPage } from '../pages/TaskManagerPage';

test.describe('Task Manager', () => {
  test.beforeEach(async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    await taskManager.goto();
  });

  test('loads the page with the correct heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'MERN Task Manager' })).toBeVisible();
  });

  test('adds a new task', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const title = `Buy groceries ${Date.now()}`;

    await taskManager.addTask(title);

    await taskManager.expectTaskVisible(title);
  });

  test('toggles a task as completed', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const title = `Read a book ${Date.now()}`;

    await taskManager.addTask(title);
    await taskManager.toggleTask(title);

    await taskManager.expectTaskCompleted(title);
  });

  test('deletes a task', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const title = `Walk the dog ${Date.now()}`;

    await taskManager.addTask(title);
    await taskManager.expectTaskVisible(title);

    await taskManager.deleteTask(title);

    await taskManager.expectTaskHidden(title);
  });

  test('does not add a task with an empty title', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const initialCount = await taskManager.taskList.locator('li').count().catch(() => 0);

    await taskManager.addButton.click();

    await expect(taskManager.taskList.locator('li')).toHaveCount(initialCount);
  });

  test('does not add a task with a whitespace-only title', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const initialCount = await taskManager.taskList.locator('li').count().catch(() => 0);

    await taskManager.addTask('   ');

    await expect(taskManager.taskList.locator('li')).toHaveCount(initialCount);
  });

  test('clears the input field after adding a task', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const title = `Clean the house ${Date.now()}`;

    await taskManager.addTask(title);

    await expect(taskManager.titleInput).toHaveValue('');
  });

  test('adds multiple tasks and displays all of them', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const timestamp = Date.now();
    const titles = [`Task A ${timestamp}`, `Task B ${timestamp}`, `Task C ${timestamp}`];

    for (const title of titles) {
      await taskManager.addTask(title);
    }

    for (const title of titles) {
      await taskManager.expectTaskVisible(title);
    }
  });

  test('untoggles a completed task back to incomplete', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const title = `Water the plants ${Date.now()}`;

    await taskManager.addTask(title);
    await taskManager.toggleTask(title);
    await taskManager.expectTaskCompleted(title);

    await taskManager.toggleTask(title);

    await expect(taskManager.taskItem(title)).not.toHaveClass(/completed/);
  });

  test('persists a task after reloading the page', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const title = `Pay bills ${Date.now()}`;

    await taskManager.addTask(title);
    await taskManager.expectTaskVisible(title);

    await page.reload();

    await taskManager.expectTaskVisible(title);
  });
});
