# Dreamworks Agent Development Guide

## Table of Contents
1. [Core Concepts](#core-concepts)
2. [Agent Architecture](#agent-architecture)
3. [Code Organization](#code-organization)
4. [Understanding Your Current Code](#understanding-your-current-code)
5. [Building Blocks Explained](#building-blocks-explained)
6. [Agent Lifecycle](#agent-lifecycle)
7. [Best Practices](#best-practices)
8. [Common Patterns](#common-patterns)

---

## Core Concepts

Dreamworks agents are built using **four main building blocks**:

### 1. **Contexts** 
- **Purpose**: Manage state and memory for specific tasks or interactions
- **Think of it as**: Isolated workspaces that maintain their own memory
- **Use for**: Storing conversation history, user preferences, task states, etc.
- **Key Properties**:
  - Each context has a `type` (e.g., "chat", "goal", "session")
  - Has a `schema` to validate context keys
  - Can `create` initial state
  - Can `render` memory into prompts for the LLM
  - Has a unique `key` function to identify contexts

### 2. **Actions**
- **Purpose**: Define tasks or capabilities the agent can perform
- **Think of it as**: Functions the agent can call to do something
- **Use for**: API calls, database operations, file manipulations, etc.
- **Key Properties**:
  - Has a `name` and `description` (tells the LLM what it does)
  - Has a `schema` to validate input parameters
  - Has a `handler` function that executes the action
  - Can access context memory and agent state

### 3. **Inputs**
- **Purpose**: Handle how the agent receives data and triggers processing
- **Think of it as**: Entry points for external data
- **Use for**: Webhooks, API endpoints, user messages, file uploads, etc.
- **Note**: Your current code uses `cliExtension` which handles CLI input automatically

### 4. **Outputs**
- **Purpose**: Determine how the agent communicates results
- **Think of it as**: Ways the agent sends information out
- **Use for**: HTTP responses, WebSocket messages, file writes, notifications, etc.

---

## Agent Architecture

```
┌─────────────────────────────────────┐
│         External Input              │
│  (CLI, API, Webhook, etc.)         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      createDreams() Agent           │
│  ┌──────────────────────────────┐   │
│  │         LLM Model            │   │
│  │  (Groq, OpenAI, etc.)       │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │         Contexts             │   │
│  │  (Memory & State Management) │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │         Actions              │   │
│  │  (Available Capabilities)    │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │         Extensions           │   │
│  │  (CLI, MCP, Custom, etc.)    │   │
│  └──────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│         External Output             │
│  (CLI, API Response, etc.)         │
└─────────────────────────────────────┘
```

---

## Code Organization

### Recommended Project Structure

```
my-agent/
├── index.ts              # Main entry point - agent initialization
├── contexts/             # Context definitions
│   ├── goalContext.ts
│   └── chatContext.ts
├── actions/              # Action definitions
│   ├── taskActions.ts
│   └── apiActions.ts
├── types/                # TypeScript type definitions
│   └── memory.ts
├── utils/                # Utility functions
│   └── helpers.ts
├── config/               # Configuration files
│   └── model.ts
└── package.json
```

### What Goes Where?

1. **`index.ts`** - Main file
   - Import all contexts and actions
   - Initialize the model (Groq, OpenAI, etc.)
   - Call `createDreams()` with all components
   - Start the agent with `agent.start()`

2. **`contexts/`** - Context definitions
   - Each file exports one or more contexts
   - Contains schema, create, render, key functions
   - Defines memory types

3. **`actions/`** - Action definitions
   - Each file groups related actions
   - Contains action handlers with business logic
   - Can be organized by domain (e.g., database, API, file operations)

4. **`types/`** - Shared TypeScript types
   - Memory types for contexts
   - Common interfaces
   - Zod schemas if shared

---

## Understanding Your Current Code

Let's break down your `index.ts`:

```typescript
// 1. MODEL SETUP
const groq = createGroq({
    apiKey: env.GROQ_API_KEY!,
});
```
- **What**: Configures the LLM provider (Groq in this case)
- **Where**: At the top, before creating contexts/actions
- **Why**: The agent needs a model to think and make decisions

```typescript
// 2. MEMORY TYPE DEFINITION
type GoalMemory = {
    goal: string;
};
```
- **What**: TypeScript type for what data is stored in context memory
- **Where**: Before the context definition that uses it
- **Why**: Type safety and clarity about what the context stores

```typescript
// 3. CONTEXT DEFINITION
const goalContexts = context({
    type: "goal",              // Unique identifier for this context type
    schema: z.object({         // Validation for context keys
        id: string(),
    }),
    key({ id }) {              // How to identify unique contexts
        return id;
    },
    create(state) {            // Initial state when context is created
        return {
            id: state.args.id,
        };
    },
    render({ memory }) {       // How to show memory to the LLM
        return render(template, {
            goal: memory.goal,
        });
    },
});
```
- **What**: Defines a context that manages goal-related state
- **Where**: Before `createDreams()`
- **Why**: Tells the agent how to store and recall goal information

```typescript
// 4. ACTION DEFINITION
action({
    name: "addTask",                    // Name the LLM will use
    description: "Add a task to the goal", // What the LLM sees
    schema: z.object({ task: z.string() }), // Input validation
    handler(call, ctx, agent) {         // What actually happens
        const agentMemory = ctx.agentMemory as GoalMemory;
        agentMemory.goal = call.data.task;
        return {};
    },
})
```
- **What**: Defines a capability the agent can use
- **Where**: Inside the `actions` array in `createDreams()`
- **Why**: Gives the agent a way to modify state

```typescript
// 5. AGENT CREATION
createDreams({
    model: groq("deepseek-r1-distill-llama-70b"),
    extensions: [cliExtension],
    contexts: [goalContext],  // Note: "contexts" (plural) as an array!
    actions: [/* actions array */],
}).start({ id: "test" });
```
- **What**: Combines everything into an agent and starts it
- **Where**: At the end of the file
- **Why**: This is where the agent comes to life

---

## Building Blocks Explained

### Contexts - Deep Dive

```typescript
const myContext = context({
    // 1. TYPE: Unique identifier
    type: "myContextType",
    
    // 2. SCHEMA: Validates the key used to identify contexts
    schema: z.object({
        userId: z.string(),
        sessionId: z.string().optional(),
    }),
    
    // 3. KEY: Creates a unique identifier from schema
    key({ userId, sessionId }) {
        return sessionId ? `${userId}-${sessionId}` : userId;
    },
    
    // 4. CREATE: Initial state when context is first created
    create(state) {
        return {
            userId: state.args.userId,
            sessionId: state.args.sessionId,
            messages: [],
            preferences: {},
        };
    },
    
    // 5. RENDER: How memory appears in LLM prompts
    render({ memory }) {
        return `
Current User: ${memory.userId}
Messages: ${memory.messages.length}
Preferences: ${JSON.stringify(memory.preferences)}
        `.trim();
    },
    
    // 6. INSTRUCTIONS (optional): Special instructions for this context
    instructions: "You are a helpful assistant for this user.",
});
```

**Key Points:**
- Each context instance has its own isolated memory
- The `key()` function determines if a new context is created or an existing one is retrieved
- `render()` is called every time the LLM needs context - keep it efficient
- Memory persists across agent interactions for the same key

### Actions - Deep Dive

```typescript
const myAction = action({
    // 1. NAME: What the LLM calls this action
    name: "searchDatabase",
    
    // 2. DESCRIPTION: What the LLM sees - be specific!
    description: "Searches the user database for matching records. Use this when the user asks about users or needs to find someone.",
    
    // 3. SCHEMA: Input validation using Zod
    schema: z.object({
        query: z.string().min(1, "Query cannot be empty"),
        filters: z.object({
            age: z.number().optional(),
            location: z.string().optional(),
        }).optional(),
    }),
    
    // 4. HANDLER: The actual function that runs
    handler: async (call, ctx, agent) => {
        // call.data - validated input from schema
        const { query, filters } = call.data;
        
        // ctx.agentMemory - access context memory
        const memory = ctx.agentMemory as MyMemory;
        
        // agent - access to agent methods if needed
        // (e.g., agent.sendMessage(), agent.getContext())
        
        // Do the actual work
        const results = await database.search(query, filters);
        
        // Return result (becomes available to LLM)
        return {
            count: results.length,
            items: results.map(r => ({
                id: r.id,
                name: r.name,
            })),
        };
    },
});
```

**Key Points:**
- The `description` is critical - the LLM uses it to decide when to call the action
- Be specific in descriptions: "Search the database" is vague, "Search for users by name or email" is better
- Handlers can be async - perfect for API calls and database operations
- Return values should be useful for the LLM to continue the conversation

### Handler Parameters Explained

```typescript
handler(call, ctx, agent) {
    // call.data - Validated input matching your schema
    // call.id - Unique identifier for this action call
    // call.name - Name of the action
    
    // ctx.agentMemory - The memory object for the current context
    // ctx.contextKey - The key identifying this context
    // ctx.contextType - The type of context
    
    // agent - Agent instance with methods like:
    //   - agent.sendMessage()
    //   - agent.getContext()
    //   - agent.updateMemory()
    
    return { /* result */ };
}
```

---

## Agent Lifecycle

The agent follows a continuous loop:

```
1. LISTEN → Receive input (CLI command, API call, webhook, etc.)
   │
   ▼
2. THINK → LLM processes input using:
   - Current context memory (from render())
   - Available actions (from descriptions)
   - Model's training/knowledge
   │
   ▼
3. DECIDE → LLM chooses:
   - Call an action? → Execute handler
   - Respond directly? → Generate response
   - Update memory? → Save to context
   │
   ▼
4. ACT → Execute chosen action or send response
   │
   ▼
5. REMEMBER → Save important information to context memory
   │
   ▼
6. OUTPUT → Send result back (CLI output, API response, etc.)
```

**Example Flow:**
1. User types: "Add task: Buy groceries"
2. Agent receives input via CLI extension
3. LLM sees available `addTask` action
4. LLM calls `addTask` with `{ task: "Buy groceries" }`
5. Handler updates context memory: `goal = "Buy groceries"`
6. Agent confirms: "Task added: Buy groceries"
7. Memory persists for next interaction

---

## Best Practices

### 1. Context Design
- ✅ **DO**: Create separate contexts for different concerns
  ```typescript
  const userContext = context({ type: "user", ... });
  const chatContext = context({ type: "chat", ... });
  const sessionContext = context({ type: "session", ... });
  ```
- ❌ **DON'T**: Put everything in one context
- ✅ **DO**: Keep memory structures simple and flat when possible
- ✅ **DO**: Use clear, descriptive context types

### 2. Action Design
- ✅ **DO**: Write detailed, specific descriptions
  ```typescript
  // ❌ Bad
  description: "Saves data"
  
  // ✅ Good
  description: "Saves a user's task to the database. Use this when the user wants to store a new task or update an existing one. Requires a task text and optional due date."
  ```
- ✅ **DO**: Use Zod schemas to validate and type inputs
- ✅ **DO**: Return meaningful results that help the LLM continue
- ❌ **DON'T**: Make actions too generic or too specific

### 3. Memory Management
- ✅ **DO**: Update memory in action handlers when state changes
- ✅ **DO**: Keep memory sizes reasonable (don't store huge objects)
- ✅ **DO**: Use `render()` to format memory nicely for the LLM
- ❌ **DON'T**: Store sensitive data without encryption

### 4. Error Handling
- ✅ **DO**: Handle errors gracefully in action handlers
  ```typescript
  handler: async (call, ctx) => {
      try {
          const result = await riskyOperation();
          return { success: true, data: result };
      } catch (error) {
          return { 
              success: false, 
              error: error.message,
              suggestion: "Please try again with different parameters"
          };
      }
  }
  ```

### 5. Code Organization
- ✅ **DO**: Split contexts and actions into separate files
- ✅ **DO**: Use consistent naming conventions
- ✅ **DO**: Add comments for complex logic
- ✅ **DO**: Type everything with TypeScript

---

## Common Patterns

### Pattern 1: Simple Chat Agent

```typescript
const chatContext = context({
    type: "chat",
    schema: z.object({ userId: z.string() }),
    key: ({ userId }) => userId,
    create: () => ({ messages: [] }),
    render: ({ memory }) => {
        return memory.messages
            .map(m => `${m.role}: ${m.content}`)
            .join('\n');
    },
});

const sendMessage = action({
    name: "sendMessage",
    description: "Sends a message to the user",
    schema: z.object({ message: z.string() }),
    handler: (call, ctx) => {
        const memory = ctx.agentMemory as { messages: any[] };
        memory.messages.push({
            role: "assistant",
            content: call.data.message,
        });
        return { sent: true };
    },
});

createDreams({
    model: groq("deepseek-r1-distill-llama-70b"),
    extensions: [cliExtension],
    contexts: [chatContext],  // Note: "contexts" (plural) as an array!
    actions: [sendMessage],
}).start({ userId: "user123" });
```

### Pattern 2: Task Management Agent

```typescript
type TaskMemory = {
    tasks: Array<{ id: string; text: string; completed: boolean }>;
};

const taskContext = context<TaskMemory>({
    type: "tasks",
    schema: z.object({ listId: z.string() }),
    key: ({ listId }) => listId,
    create: () => ({ tasks: [] }),
    render: ({ memory }) => {
        const incomplete = memory.tasks.filter(t => !t.completed);
        const complete = memory.tasks.filter(t => t.completed);
        return `
Active Tasks (${incomplete.length}):
${incomplete.map(t => `- ${t.text}`).join('\n')}

Completed Tasks (${complete.length}):
${complete.map(t => `- ${t.text}`).join('\n')}
        `.trim();
    },
});

const addTask = action({
    name: "addTask",
    description: "Adds a new task to the list",
    schema: z.object({ text: z.string() }),
    handler: (call, ctx) => {
        const memory = ctx.agentMemory as TaskMemory;
        memory.tasks.push({
            id: Date.now().toString(),
            text: call.data.text,
            completed: false,
        });
        return { added: true, taskId: memory.tasks[memory.tasks.length - 1].id };
    },
});

const completeTask = action({
    name: "completeTask",
    description: "Marks a task as completed",
    schema: z.object({ taskId: z.string() }),
    handler: (call, ctx) => {
        const memory = ctx.agentMemory as TaskMemory;
        const task = memory.tasks.find(t => t.id === call.data.taskId);
        if (task) {
            task.completed = true;
            return { completed: true };
        }
        return { error: "Task not found" };
    },
});
```

### Pattern 3: API Integration Agent

```typescript
const apiAction = action({
    name: "fetchWeather",
    description: "Fetches current weather data for a location. Use this when user asks about weather.",
    schema: z.object({
        location: z.string(),
        units: z.enum(["celsius", "fahrenheit"]).optional(),
    }),
    handler: async (call) => {
        const response = await fetch(
            `https://api.weather.com/...?location=${call.data.location}`
        );
        const data = await response.json();
        return {
            temperature: data.temp,
            condition: data.condition,
            location: call.data.location,
        };
    },
});
```

---

## Next Steps

1. **Refactor your code**: Split contexts and actions into separate files
2. **Add more actions**: Think about what capabilities your agent needs
3. **Improve descriptions**: Make action descriptions more specific
4. **Add error handling**: Wrap risky operations in try-catch
5. **Expand memory**: Add more useful fields to your context memory
6. **Test thoroughly**: Try different inputs and edge cases

---

## Resources

- Official Docs: https://docs.dreams.fun/docs/
- Discord/Slack: Check docs for community links
- Examples: Look for example repositories in the docs

