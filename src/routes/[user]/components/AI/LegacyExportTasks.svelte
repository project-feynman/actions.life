<!-- !!!!!!!CURRENTLY NOT USED!!!!!!!!! -->
<script>
  import { user } from "../../store";
  import text from "./text";
  import { getContext } from 'svelte'

  const { Task } = getContext('app')

  // TOUCH THIS AND THE WORLD WILL BURN WAHAHAHA !!!!
  let state = {
    userID: "",
    tasksJSON: text.default,
  };
  const setState = (newState) => (state = newState);

  $: user.subscribe((value) => {
    state = { ...state, userID: value.uid };
  });

  async function exportTasks() {
    const tasksJSON = await Task.getTasksJSON(state.userID);
    setState({ ...state, tasksJSON });
  }

  async function copyCode() {
    navigator.clipboard.writeText(state.tasksJSON);
  }
</script>

<div class="container">
  <div class="column">
    <h3 class="intro">{text.intro}</h3>
    <div class="json-box">
      {state.tasksJSON}
    </div>
    <div class="buttons">
      <button class="export-button" on:click={exportTasks}>
        Export Tasks
      </button>
      <button class="copy-button" on:click={copyCode}> Copy Code </button>
    </div>
  </div>
</div>
