import { Command } from 'commander'
import { resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { appendFailureNote } from './append-failure-note.js'

function readTaskText(taskPath: string): string | undefined {
  if (!existsSync(taskPath)) return undefined
  const t = readFileSync(taskPath, 'utf8').trim()
  return t.length ? t : undefined
}

export async function runNotesCli(argv: string[]) {
  const program = new Command()

  program
    .name('confucius-notes')
    .description('Confucius notes utilities')
    .option('--root <path>', 'repo root path', process.cwd())

  program
    .command('append-failure')
    .description('Append a failure note from the latest proof artifact')
    .option('--proof <path>', 'path to last-proof.json', '.confucius/last-proof.json')
    .option('--task <path>', 'path to task.txt', '.confucius/task.txt')
    .action(async (options) => {
      const { root } = program.opts<{ root: string }>()
      const _proofPathAbs = resolve(root, options.proof)
      const taskPathAbs = resolve(root, options.task)
      const taskText = readTaskText(taskPathAbs)

      appendFailureNote(root, {
        title: 'Manual append failure note',
        summary: 'notes CLI invoked',
        severity: 'medium',
        type: 'finding',
        tags: ['manual', 'notes-cli'],
        components: ['notes', 'cli'],
        proofPath: options.proof,
        taskPath: options.task,
        taskText,
        exitCode: 1,
        contractMode: 'local',
        runtimeMode: 'simulated',
        strictMode: false
      })
    })

  // Important: this enables async actions without wrapper hacks
  await program.parseAsync(argv)
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  runNotesCli(process.argv).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
