export function initSkillsPopups() {
    // Native details provide keyboard, touch, and no-JavaScript access to evidence.
    const skills = [...document.querySelectorAll('details.skill')];
    for (const skill of skills) {
        skill.addEventListener('toggle', () => {
            if (!skill.open) return;
            for (const other of skills) if (other !== skill) other.open = false;
        });
    }
}
