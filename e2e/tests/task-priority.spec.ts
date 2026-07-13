import { test, expect } from '@playwright/test';
import { TaskManagerPage } from '../pages/TaskManagerPage';

test.describe('Task Priority', () => {
  test.beforeEach(async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    await taskManager.goto();
  });

  test('defaults to medium priority in the add-task form', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);

    await expect(taskManager.formPrioritySelect).toHaveValue('medium');
  });

  test('adds a task with the default medium priority', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const title = `Default priority task ${Date.now()}`;

    await taskManager.addTask(title);

    await taskManager.expectTaskPriority(title, 'medium');
  });

  test('adds a task with low priority', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const title = `Low priority task ${Date.now()}`;

    await taskManager.addTask(title, 'low');

    await taskManager.expectTaskPriority(title, 'low');
  });

  test('adds a task with high priority', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const title = `High priority task ${Date.now()}`;

    await taskManager.addTask(title, 'high');

    await taskManager.expectTaskPriority(title, 'high');
  });

  test('resets the form priority back to medium after adding a task', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const title = `Reset priority task ${Date.now()}`;

    await taskManager.addTask(title, 'high');

    await expect(taskManager.formPrioritySelect).toHaveValue('medium');
  });

  test('changes an existing task priority from the task list', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const title = `Change priority task ${Date.now()}`;

    await taskManager.addTask(title, 'low');
    await taskManager.expectTaskPriority(title, 'low');

    await taskManager.setTaskPriority(title, 'high');

    await taskManager.expectTaskPriority(title, 'high');
  });

  test('persists an updated task priority after reloading the page', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const title = `Persist priority task ${Date.now()}`;

    await taskManager.addTask(title, 'medium');
    await taskManager.setTaskPriority(title, 'high');
    await taskManager.expectTaskPriority(title, 'high');

    await page.reload();

    await taskManager.expectTaskPriority(title, 'high');
  });

  test('tracks priority independently for multiple tasks', async ({ page }) => {
    const taskManager = new TaskManagerPage(page);
    const timestamp = Date.now();
    const low = `Multi low ${timestamp}`;
    const medium = `Multi medium ${timestamp}`;
    const high = `Multi high ${timestamp}`;

    await taskManager.addTask(low, 'low');
    await taskManager.expectTaskVisible(low);
    await taskManager.addTask(medium, 'medium');
    await taskManager.expectTaskVisible(medium);
    await taskManager.addTask(high, 'high');
    await taskManager.expectTaskVisible(high);

    await taskManager.expectTaskPriority(low, 'low');
    await taskManager.expectTaskPriority(medium, 'medium');
    await taskManager.expectTaskPriority(high, 'high');
  });
});
