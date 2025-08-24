// Helper: calculate entropy
function calculateEntropy(password) {
    let charset = 0;
    if (/[a-z]/.test(password)) charset += 26;
    if (/[A-Z]/.test(password)) charset += 26;
    if (/[0-9]/.test(password)) charset += 10;
    if (/[^A-Za-z0-9]/.test(password)) charset += 32;
    return charset > 0 ? (password.length * Math.log2(charset)) : 0;
}

function uniqueCharsCount(str) {
    return new Set(str).size;
}

async function checkPwned(password) {
    const sha1 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', sha1);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    try {
        const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
        const text = await res.text();
        return !text.split('\n').some(line => line.startsWith(suffix));
    } catch (e) {
        return null;
    }
}

const passwordInput = document.getElementById('password');
const feedback = document.getElementById('feedback');
const strengthBar = document.getElementById('strength-bar');
const barFill = document.querySelector('.bar-fill');
const requirements = {
    len: false,
    upper: false,
    lower: false,
    number: false,
    symbol: false,
    unique: false,
    entropy: false,
    pwned: false
};
const minEntropy = 70;

let lastPwnedPassword = '';
let lastPwnedResult = null;
let pwnedTimeout = null;

function updateRequirements(password) {
    requirements.len = password.length >= 12;
    requirements.upper = /[A-Z]/.test(password);
    requirements.lower = /[a-z]/.test(password);
    requirements.number = /[0-9]/.test(password);
    requirements.symbol = /[^A-Za-z0-9]/.test(password);
    requirements.unique = uniqueCharsCount(password) >= Math.floor(password.length * 0.7);
    requirements.entropy = calculateEntropy(password) >= minEntropy;
}

async function checkPassword() {
    const pwd = passwordInput.value;
    updateRequirements(pwd);

    // UI feedback
    for (const [key, val] of Object.entries(requirements)) {
        const li = document.getElementById(key);
        if (key !== 'pwned') {
            li.className = val ? 'valid' : 'invalid';
        }
    }

    // Strength bar
    let score = Object.values(requirements).slice(0,7).filter(Boolean).length;
    let percent = Math.floor((score / 7) * 100);
    barFill.style.width = percent + "%";
    let barColor;
    if (percent > 90) {
        barColor = '#33ff99';
    } else if (percent > 70) {
        barColor = '#52e2b9';
    } else if (percent > 50) {
        barColor = '#ffff3b';
    } else if (percent > 30) {
        barColor = '#ffa600';
    } else {
        barColor = '#ff506f';
    }
    barFill.style.background = `linear-gradient(90deg, ${barColor} 0%, #191c32 100%)`;

    // Entropy feedback
    let msg = '';
    if (!requirements.entropy && pwd.length > 0) {
        msg += `Password entropy is too low (${calculateEntropy(pwd).toFixed(1)} bits, need 70+).<br>`;
    }
    if (score === 7) {
        msg += `<span style="color:#33ff99;font-weight:500;">Your password is very strong (pending breach check).</span>`;
    } else if (score > 4) {
        msg += `<span style="color:#ffa600;font-weight:500;">Password is okay but could be improved.</span>`;
    } else if (pwd.length > 0) {
        msg += `<span style="color:#ff506f;font-weight:500;">Password is weak.</span>`;
    }
    feedback.innerHTML = msg;

    // Pwned check
    const pwnedLi = document.getElementById('pwned');
    if (pwd.length === 0) {
        pwnedLi.className = 'invalid';
        pwnedLi.innerText = 'Not found in data breaches';
        requirements.pwned = false;
        return;
    }
    if (pwd === lastPwnedPassword && lastPwnedResult !== null) {
        pwnedLi.className = lastPwnedResult ? 'valid' : 'invalid';
        pwnedLi.innerText = lastPwnedResult ? 'Not found in data breaches' : 'Found in data breaches!';
        requirements.pwned = lastPwnedResult;
        return;
    }
    pwnedLi.className = '';
    pwnedLi.innerText = 'Checking breach databases...';
    requirements.pwned = false;

    if (pwnedTimeout) clearTimeout(pwnedTimeout);
    pwnedTimeout = setTimeout(async () => {
        const safe = await checkPwned(pwd);
        if (pwd !== passwordInput.value) return; // User changed
        if (safe === null) {
            pwnedLi.className = 'invalid';
            pwnedLi.innerText = 'Could not check for breaches';
            requirements.pwned = false;
        } else {
            lastPwnedPassword = pwd;
            lastPwnedResult = safe;
            pwnedLi.className = safe ? 'valid' : 'invalid';
            pwnedLi.innerText = safe ? 'Not found in data breaches' : 'Found in data breaches!';
            requirements.pwned = safe;
        }
    }, 600);
}

passwordInput.addEventListener('input', checkPassword);
checkPassword();