/**
 * JAMIA ASHRAFIA LAHORE - INSTITUTIONAL HERITAGE & ARCHIVES MODULE
 * Text extracted and summarized directly from Wikipedia and Historical Records
 */

const InstitutionalModule = {
    render() {
        const inst = window.LmsData.institution || {};
        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-landmark" style="color: var(--gold-400);"></i>
                        Institutional Heritage & History
                        <span class="badge-pill gold" style="font-size: 0.8rem;">Est. 1947</span>
                    </h1>
                    <p>Historical background, founding legacy, leadership lineage, and branch network of Ashrafia Islamic University Lahore</p>
                </div>
                <div class="view-actions">
                    <a href="https://en.wikipedia.org/wiki/Jamia_Ashrafia" target="_blank" class="btn btn-secondary btn-sm">
                        <i class="fab fa-wikipedia-w"></i> Wikipedia Reference
                    </a>
                    <a href="https://jamiaashrafia.org" target="_blank" class="btn btn-gold btn-sm">
                        <i class="fas fa-globe"></i> Official Portal
                    </a>
                </div>
            </div>

            <!-- HERO PHOTO & CREST BANNER -->
            <div class="ashrafia-hero-card">
                <div class="ashrafia-hero-content">
                    <div class="ashrafia-hero-badge">
                        <i class="fas fa-mosque"></i> Center of Islamic Scholarship & Dars-e-Nizami
                    </div>
                    <h2 class="ashrafia-hero-title">Jamia Ashrafia Lahore</h2>
                    <p class="ashrafia-hero-desc">${I18n.t(`Founded on <strong>14 September 1947</strong>, just one month following the independence of Pakistan, Jamia Ashrafia was established by the eminent scholar <strong>Hazrat Maulana Mufti Muhammad Hassan Amritsari (RA)</strong>. In recognition of the immense spiritual guidance and unwavering support for an independent Muslim homeland, the institution was named in honor of the revered Hakim al-Ummah <strong>Hazrat Maulana Ashraf Ali Thanwi (RA)</strong>.`)}</p>
                    <div class="ashrafia-hero-stats">
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">1947</span>
                            <span class="hero-stat-label">Year Founded</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">120 Kanals</span>
                            <span class="hero-stat-label">Main Campus Land</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">${(inst.branches || []).length}</span>
                            <span class="hero-stat-label">Campuses & Branches</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">${(inst.branches || []).reduce((n, b) => n + (Number(b.students) || 0), 0).toLocaleString()}</span>
                            <span class="hero-stat-label">Student Strength</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">Wifaq al-Arabia</span>
                            <span class="hero-stat-label">Academic Board</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- HISTORICAL TIMELINE & NARRATIVE -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 28px;">
                <!-- Origin & Relocation Card -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fas fa-history"></i> Founding & Campus Expansion
                        </h3>
                    </div>
                    <div style="font-size: 0.92rem; color: var(--text-secondary); line-height: 1.7;">
                        <p style="margin-bottom: 12px;">${I18n.t(`<strong>Nila Gumbad Anarkali (1947):</strong> Jamia Ashrafia commenced in a historic three-storied quadrangular building at Nila Gumbad in the vibrant historic center of Lahore. The initial classes quickly attracted seekers of sacred knowledge from across the subcontinent.`)}</p>
                        <p style="margin-bottom: 12px;">${I18n.t(`<strong>Ferozepur Road Campus (1955-1957):</strong> On <strong>28 March 1955</strong>, a sprawling 120-kanal estate situated between Canal Road and Ferozepur Road was acquired. Construction began with the laying of the foundation stone for the central Grand Jamia Mosque. By 1957, the faculty and residential students relocated to this majestic new campus.`)}</p>
                        <p>${I18n.t(`<strong>Faculty of Hadith (1958):</strong> Teaching of classical Hadith courses was formally inaugurated in 1958 under the globally celebrated Muhaddith <strong>Hazrat Maulana Muhammad Idris Kandhlawi (RA)</strong>, author of <em>Ma'arif al-Quran</em> and <em>At-Ta'liq as-Sabih</em>.`)}</p>
                    </div>
                </div>

                <!-- Leadership & Legacy Card -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fas fa-users-crown"></i> Spiritual & Academic Lineage
                        </h3>
                    </div>
                    <div style="font-size: 0.92rem; color: var(--text-secondary); line-height: 1.7;">
                        <p style="margin-bottom: 12px;">${I18n.t(`Following the passing of the founder <strong>Mufti Muhammad Hassan</strong> on 1 June 1961, institutional leadership and preservation of high academic standards were carried forward by his distinguished sons:`)}</p>
                        <ul style="padding-inline-start: 20px; margin-bottom: 12px;">
                            <li>${I18n.t(`<strong>Maulana Mufti Muhammad Ubaidullah (Late):</strong> Pioneered international academic outreach.`)}</li>
                            <li>${I18n.t(`<strong>Maulana Abd-ur-Rahman Ashrafi (Late):</strong> Champion of community welfare and education.`)}</li>
                        </ul>
                        ${(inst.leadership || []).length ? `
                            <p style="margin-bottom: 6px;"><strong>Current leadership:</strong></p>
                            <ul style="padding-inline-start: 20px; margin-bottom: 12px;">
                                ${inst.leadership.map(l => `<li><strong>${Lms.esc(l.name)}</strong>${l.office ? ` — ${Lms.esc(l.office)}` : ''}</li>`).join('')}
                            </ul>` : ''}
                        <p>${I18n.t(`<strong>Wifaq ul Madaris Equivalence:</strong> The <em>Shahadat-ul-Alimiyyah</em> degree awarded by Jamia Ashrafia under Wifaq-ul-Madaris Al-Arabia Pakistan is recognized by the Higher Education Commission (HEC) of Pakistan as equivalent to an M.A. in Islamic Studies and Arabic.`)}</p>
                    </div>
                </div>
            </div>

            <!-- 12 BRANCHES NETWORK SHOWCASE -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-network-wired"></i> ${I18n.t('Branch Network ({n} Campuses)', { n: (inst.branches || []).length })}
                    </h3>
                </div>
                ${(inst.branches || []).length > 1 ? Lms.filterBar('branch-network-table', {
                    search: 'Search branch name, code or location...',
                    selects: [{ key: 'type', label: 'All campus types', options: [['GENERAL', 'Campus'], ['WOMEN', 'Women\'s Campus']] }]
                }) : ''}
                <div class="table-responsive">
                    <table class="data-table" id="branch-network-table">
                        <thead>
                            <tr>
                                <th>Branch Name</th>
                                <th>Location</th>
                                <th>Type</th>
                                <th>Est. Year</th>
                                <th>Student Strength</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(inst.branches || []).map(b => `
                                <tr data-f-type="${b.isWomens ? 'WOMEN' : 'GENERAL'}">
                                    <td>
                                        <div style="font-weight: 700; color: var(--primary-950);">${Lms.esc(b.name)}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-muted);">${Lms.esc(b.code)}</div>
                                    </td>
                                    <td><i class="fas fa-map-marker-alt" style="color: var(--danger); margin-inline-end: 6px;"></i>${Lms.esc(b.location || Lms.branchLocation(b))}</td>
                                    <td>
                                        ${b.isWomens ? 
                                            '<span class="status-pill warning"><i class="fas fa-female"></i> Women\'s Campus</span>' : 
                                            '<span class="status-pill info"><i class="fas fa-university"></i> Main Academic</span>'}
                                    </td>
                                    <td>${Lms.esc(b.established || '—')}</td>
                                    <td><strong>${Number(b.students || 0).toLocaleString()}</strong> Students</td>
                                    <td><span class="status-pill success"><i class="fas fa-check-circle"></i> Connected to LMS</span></td>
                                </tr>
                            `).join('') || `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No campuses set up yet.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- COMMUNITY IMPACT & HOSPITAL -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
                <div class="card" style="border-inline-start: 4px solid var(--primary-500);">
                    <div class="card-header">
                        <h4 class="card-title"><i class="fas fa-hospital-alt"></i> Ashrafia Free Charitable Hospital</h4>
                    </div>
                    <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.6;">
                        In addition to sacred scholarship, Jamia Ashrafia operates a full-service charitable hospital on Ferozepur Road, 
                        providing free diagnostics, outpatient care, emergency treatments, and essential medicines to thousands of underprivileged citizens daily.
                    </p>
                </div>
                <div class="card" style="border-inline-start: 4px solid var(--gold-400);">
                    <div class="card-header">
                        <h4 class="card-title"><i class="fas fa-book-reader"></i> Maktaba Ashrafia & Darul Ifta</h4>
                    </div>
                    <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.6;">
                        Maktaba Ashrafia maintains tens of thousands of rare classical Islamic manuscripts, Hadith compendiums, and Fatawa volumes. 
                        Its Darul Ifta is an internationally trusted authority rendering authoritative Shariah guidance on contemporary Islamic banking, bioethics, and family law.
                    </p>
                </div>
            </div>
        `;
    },

    async fetchLiveBranches() {
        try {
            const res = await fetch('/api/branches');
            if (!res.ok) return;
            const data = await res.json();
            if (data && data.branches && window.LmsData) {
                if (!window.LmsData.institution) window.LmsData.institution = {};
                window.LmsData.institution.branches = data.branches;
                if (window.DataStore) window.DataStore.save(window.LmsData);

                const viewport = document.getElementById('main-content-viewport');
                if (viewport && window.App && window.App.currentRoute === 'heritage') {
                    viewport.innerHTML = this.render();
                }
            }
        } catch (err) {
            console.warn('[Institutional] Could not load live branches:', err);
        }
    }
};

window.InstitutionalModule = InstitutionalModule;
