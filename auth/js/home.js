// Renders the nav auth controls (Sign In / Register, or account + Sign Out)
// based on Auth module state. See auth/js/auth.js for the Auth module.
document.addEventListener('DOMContentLoaded', async () => {
    await Auth.ready;
    render();
});

function render() {
    const isAuth = Auth.isAuthenticated();
    const user = Auth.getUser();

    const controls = document.getElementById('nav-auth-controls');
    if (!controls) return;

    if (isAuth) {
        controls.innerHTML = `
            <span class="text-muted-light small d-none d-md-inline">${user.email}</span>
            <button class="btn btn-sm btn-outline-plain" type="button" onclick="handleLogout()">Sign Out</button>
        `;
    } else {
        const registerUrl = controls.dataset.registerUrl || 'auth/register.html';
        const loginUrl = controls.dataset.loginUrl || 'auth/login.html';
        controls.innerHTML = `
            <a class="btn btn-sm btn-outline-plain" href="${registerUrl}">Register</a>
            <a class="btn btn-sm btn-outline-plain" href="${loginUrl}">Sign In</a>
        `;
    }
}

async function handleLogout() {
    if (!confirm('Sign out?')) return;
    await Auth.logout();
    render();
}
