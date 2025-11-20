const GEDCOM_PATH = "data/ray-family-tree.ged";

const state = {
  people: {},
  families: {},
  orderedIds: [],
  filteredIds: [],
  selectedId: null,
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  wireEvents();
  hydrate();
});

function cacheElements() {
  els.status = document.getElementById("statusMessage");
  els.peopleList = document.getElementById("peopleList");
  els.search = document.getElementById("searchInput");
  els.selected = document.getElementById("selectedPerson");
  els.parents = document.getElementById("parentsList");
  els.spouses = document.getElementById("spousesList");
  els.children = document.getElementById("childrenList");
}

function wireEvents() {
  els.search?.addEventListener("input", () => {
    const query = els.search.value.trim().toLowerCase();
    state.filteredIds = state.orderedIds.filter((id) =>
      formatName(state.people[id]).toLowerCase().includes(query)
    );
    renderPeopleList();
  });
}

async function hydrate() {
  setStatus("Loading family data…");
  try {
    const gedcom = await fetch(GEDCOM_PATH);
    if (!gedcom.ok) {
      throw new Error(`Failed to fetch GEDCOM: ${gedcom.statusText}`);
    }
    const text = await gedcom.text();
    const data = parseGedcom(text);
    state.people = data.people;
    state.families = data.families;
    state.orderedIds = Object.keys(state.people).sort((a, b) =>
      formatName(state.people[a]).localeCompare(formatName(state.people[b]))
    );
    state.filteredIds = [...state.orderedIds];
    renderPeopleList();
    const defaultId = findDefaultPersonId();
    if (defaultId) {
      selectPerson(defaultId);
    }
    setStatus(`Loaded ${state.orderedIds.length} relatives`, "success");
  } catch (error) {
    console.error(error);
    setStatus("Could not load family details. Please refresh.", "error");
  }
}

function findDefaultPersonId() {
  const preferred = state.orderedIds.find((id) =>
    /owen/i.test(formatName(state.people[id]))
  );
  return preferred ?? state.orderedIds[0] ?? null;
}

function setStatus(message, tone = "info") {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.dataset.tone = tone;
}

function renderPeopleList() {
  if (!els.peopleList) return;
  els.peopleList.innerHTML = "";
  if (state.filteredIds.length === 0) {
    const empty = document.createElement("div");
    empty.className = "placeholder";
    empty.textContent = "No relatives match that search.";
    els.peopleList.appendChild(empty);
    return;
  }
  state.filteredIds.forEach((id) => {
    const person = state.people[id];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "person-listing";
    if (state.selectedId === id) {
      card.classList.add("active");
    }
    card.innerHTML = `
      <h4>${formatName(person)}</h4>
      <p>${formatLifeSpan(person)}</p>
    `;
    card.addEventListener("click", () => selectPerson(id));
    els.peopleList.appendChild(card);
  });
}

function selectPerson(id) {
  state.selectedId = id;
  const person = state.people[id];
  renderSelectedPerson(person);
  renderMiniCards(els.parents, getParents(person));
  renderMiniCards(els.spouses, getSpouses(person));
  renderMiniCards(els.children, getChildren(person));
  renderPeopleList();
}

function renderSelectedPerson(person) {
  if (!els.selected || !person) return;
  const life = formatLifeSpan(person);
  const birthPlace = person?.birth?.place ?? "";
  const residences = person.residences?.map((r) => r.place).filter(Boolean) || [];
  const locationLine = [birthPlace, ...residences].filter(Boolean).join(" • ");
  els.selected.innerHTML = `
    <div class="chip">${person.sex === "F" ? "Female" : person.sex === "M" ? "Male" : "Unknown"}</div>
    <h2>${formatName(person)}</h2>
    <div class="meta">${life || "Dates unavailable"}</div>
    ${
      locationLine
        ? `<div class="meta">${locationLine}</div>`
        : `<div class="meta muted">No locations recorded</div>`
    }
  `;
}

function renderMiniCards(container, entries) {
  if (!container) return;
  container.innerHTML = "";
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "placeholder";
    empty.textContent = "—";
    container.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const div = document.createElement("div");
    div.className = "mini-card";
    div.innerHTML = `
      <strong>${entry.name}</strong>
      <span>${entry.meta}</span>
    `;
    div.addEventListener("click", () => selectPerson(entry.id));
    container.appendChild(div);
  });
}

function getParents(person) {
  if (!person?.familyChild) return [];
  const family = state.families[person.familyChild];
  if (!family) return [];
  return ["husband", "wife"]
    .map((role) => family[role])
    .filter(Boolean)
    .map((id) => toMiniCard(state.people[id]));
}

function getSpouses(person) {
  if (!person?.familiesSpouse?.length) return [];
  const spouses = [];
  person.familiesSpouse.forEach((famId) => {
    const family = state.families[famId];
    if (!family) return;
    const spouseId =
      family.husband === person.id ? family.wife : family.wife === person.id ? family.husband : null;
    if (spouseId && state.people[spouseId]) {
      const marriageMeta = family.marriage?.date
        ? `Married ${family.marriage.date}`
        : formatLifeSpan(state.people[spouseId]);
      spouses.push({
        id: spouseId,
        name: formatName(state.people[spouseId]),
        meta: marriageMeta,
      });
    }
  });
  return spouses;
}

function getChildren(person) {
  if (!person?.familiesSpouse?.length) return [];
  const kids = [];
  person.familiesSpouse.forEach((famId) => {
    const family = state.families[famId];
    family?.children?.forEach((childId) => {
      const child = state.people[childId];
      if (child) {
        kids.push(toMiniCard(child));
      }
    });
  });
  return kids;
}

function toMiniCard(person) {
  return {
    id: person.id,
    name: formatName(person),
    meta: formatLifeSpan(person),
  };
}

function formatName(person) {
  return person?.name?.replace(/[\/"]/g, "").trim() || "Unnamed relative";
}

function formatLifeSpan(person) {
  const birthYear = extractYear(person?.birth?.date);
  const deathYear = extractYear(person?.death?.date);
  if (!birthYear && !deathYear) return "";
  return `${birthYear || "?"} – ${deathYear || ""}`.trim();
}

function extractYear(text = "") {
  const match = text.match(/(1[0-9]{3}|20[0-9]{2}|2100)/);
  return match ? match[0] : "";
}

function parseGedcom(text) {
  const individuals = {};
  const families = {};
  const lines = text.split(/\r?\n/);
  let context = null;

  lines.forEach((raw) => {
    if (!raw.trim()) return;
    const match = raw.match(/^(\d+)\s+(?:(@[A-Za-z0-9_]+@)\s+)?(\S+)(?:\s+(.*))?$/);
    if (!match) return;
    const level = Number(match[1]);
    const pointer = match[2] || null;
    const tag = match[3];
    const value = match[4]?.trim() ?? "";

    if (level === 0) {
      context = null;
      if (tag === "INDI" && pointer) {
        const record = individuals[pointer] ?? {
          id: pointer,
        };
        individuals[pointer] = record;
        record.familiesSpouse = record.familiesSpouse ?? [];
        record.residences = record.residences ?? [];
        context = { type: "INDI", record, detailTarget: null };
      } else if (tag === "FAM" && pointer) {
        const record = families[pointer] ?? {
          id: pointer,
          children: [],
        };
        families[pointer] = record;
        record.children = record.children ?? [];
        context = { type: "FAM", record, detailTarget: null };
      }
      return;
    }

    if (!context) return;
    const { record } = context;

    if (context.type === "INDI") {
      if (level === 1) {
        context.detailTarget = null;
        switch (tag) {
          case "NAME":
            record.name = value;
            break;
          case "SEX":
            record.sex = value;
            break;
          case "BIRT":
            record.birth = record.birth ?? {};
            context.detailTarget = record.birth;
            break;
          case "DEAT":
            record.death = record.death ?? {};
            context.detailTarget = record.death;
            break;
          case "RESI": {
            const block = {};
            record.residences.push(block);
            context.detailTarget = block;
            break;
          }
          case "FAMS":
            record.familiesSpouse.push(value);
            break;
          case "FAMC":
            record.familyChild = value;
            break;
          default:
            break;
        }
      } else if (level === 2 && context.detailTarget) {
        if (tag === "DATE") {
          context.detailTarget.date = value;
        } else if (tag === "PLAC") {
          context.detailTarget.place = value;
        }
      }
    } else if (context.type === "FAM") {
      if (level === 1) {
        context.detailTarget = null;
        switch (tag) {
          case "HUSB":
            record.husband = value;
            break;
          case "WIFE":
            record.wife = value;
            break;
          case "CHIL":
            record.children.push(value);
            break;
          case "MARR":
            record.marriage = record.marriage ?? {};
            context.detailTarget = record.marriage;
            break;
          default:
            break;
        }
      } else if (level === 2 && context.detailTarget) {
        if (tag === "DATE") {
          context.detailTarget.date = value;
        } else if (tag === "PLAC") {
          context.detailTarget.place = value;
        }
      }
    }
  });

  return { people: individuals, families };
}
