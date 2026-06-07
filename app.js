/* ============================================================
   Podlevskikh Automation — interactions
   ============================================================ */
(function () {
  "use strict";

  /* ---------- nav shadow on scroll ---------- */
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- scroll reveal ---------- */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  // Failsafe: never leave content hidden if IO is throttled (background tab,
  // capture tools, odd browsers). Reveal everything currently in/above the
  // fold immediately, and force-reveal the rest after a short grace period.
  const revealNow = (el) => el.classList.add("in");
  document.querySelectorAll(".reveal").forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 1.1) revealNow(el);
  });
  window.addEventListener("load", () => {
    setTimeout(() => document.querySelectorAll(".reveal").forEach(revealNow), 1400);
  });

  /* ---------- animated counters ---------- */
  const counted = new WeakSet();
  const countIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || counted.has(e.target)) return;
        counted.add(e.target);
        const el = e.target;
        const target = parseFloat(el.dataset.count);
        const dur = 1400;
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          const val = Math.round(target * eased);
          el.firstChild.nodeValue = val.toString();
          if (p < 1) requestAnimationFrame(tick);
          else el.firstChild.nodeValue = target.toString();
        };
        requestAnimationFrame(tick);
      });
    },
    { threshold: 0.6 }
  );
  document.querySelectorAll("[data-count]").forEach((el) => countIO.observe(el));

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".faq-q").forEach((q) => {
    q.addEventListener("click", () => {
      const item = q.closest(".faq-item");
      const a = item.querySelector(".faq-a");
      const open = item.classList.contains("open");
      // close siblings
      document.querySelectorAll(".faq-item.open").forEach((other) => {
        if (other !== item) {
          other.classList.remove("open");
          other.querySelector(".faq-a").style.maxHeight = null;
        }
      });
      if (open) {
        item.classList.remove("open");
        a.style.maxHeight = null;
      } else {
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  });

  /* ---------- service card spotlight ---------- */
  document.querySelectorAll(".svc").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
      card.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
    });
  });

  /* ---------- contact form → FormSubmit.co AJAX → jobs@podlevskikh.com ---------- */
  const form = document.getElementById("quote-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector(".submit");
      const btnHTML = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = "Sending…";
      try {
        const r = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });
        if (!r.ok) throw 0;
        form.querySelector(".form-success").classList.add("show");
        form.querySelectorAll("input, textarea, select, .btn").forEach((el) => {
          if (!el.closest(".form-success")) el.setAttribute("disabled", "");
        });
        form.querySelector(".form-success").scrollIntoView({ block: "nearest" });
      } catch (_) {
        btn.disabled = false;
        btn.innerHTML = btnHTML;
        alert("Could not send — please email jobs@podlevskikh.com directly.");
      }
    });
  }

  /* ============================================================
     Workflow diagram — broken -> fixed, with flowing packets
     ============================================================ */
  const stage = document.querySelector(".flow-stage");
  if (!stage) return;

  const svg = stage.querySelector(".flow-svg");
  const nodesWrap = stage.querySelector(".flow-nodes");
  const stateBadge = document.querySelector(".flow-state");
  const timerEl = document.querySelector(".flow-foot .timer b");
  const flowBtn = document.querySelector(".flow-btn");
  const targetNode = stage.querySelector(".fnode.target");
  const NS = "http://www.w3.org/2000/svg";

  let isFixed = false;
  let packets = [];
  let raf = null;

  function buildWires() {
    svg.innerHTML = "";
    packets = [];
    const nodes = [...nodesWrap.querySelectorAll(".fnode")];
    const stageRect = stage.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${stageRect.width} ${stageRect.height}`);

    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i].getBoundingClientRect();
      const b = nodes[i + 1].getBoundingClientRect();
      const x = a.left - stageRect.left + 28;
      const y1 = a.bottom - stageRect.top;
      const y2 = b.top - stageRect.top;
      const d = `M ${x} ${y1} C ${x} ${y1 + 12}, ${x} ${y2 - 12}, ${x} ${y2}`;

      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("class", "wire");
      // the wire entering the broken node is dead until fixed
      const entersBroken = nodes[i + 1].classList.contains("target");
      if (entersBroken && !isFixed) path.classList.add("dead");
      else path.classList.add("live");
      svg.appendChild(path);

      packets.push({ path, len: path.getTotalLength(), entersBroken, offset: Math.random() });
    }
  }

  function animatePackets(ts) {
    if (!isFixed) {
      raf = requestAnimationFrame(animatePackets);
      // when broken: only run packets on wires before the break
      svg.querySelectorAll(".pkt").forEach((p) => p.remove());
      packets.forEach((pk) => {
        if (pk.entersBroken) return; // no flow past the break
        pk.offset = (pk.offset + 0.004) % 1;
        const pt = pk.path.getPointAtLength(pk.offset * pk.len);
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("class", "pkt packet");
        c.setAttribute("r", "3.5");
        c.setAttribute("cx", pt.x);
        c.setAttribute("cy", pt.y);
        svg.appendChild(c);
      });
      return;
    }
    // fixed: all wires flow
    svg.querySelectorAll(".pkt").forEach((p) => p.remove());
    packets.forEach((pk, idx) => {
      for (let k = 0; k < 2; k++) {
        const o = (pk.offset + idx * 0.13 + k * 0.5 + ts * 0.00018) % 1;
        const pt = pk.path.getPointAtLength(o * pk.len);
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("class", "pkt packet");
        c.setAttribute("r", "3.5");
        c.setAttribute("cx", pt.x);
        c.setAttribute("cy", pt.y);
        svg.appendChild(c);
      }
    });
    raf = requestAnimationFrame(animatePackets);
  }

  function setBroken() {
    isFixed = false;
    stage.classList.remove("is-fixed");
    targetNode.classList.add("shake");
    stateBadge.className = "flow-state broken";
    stateBadge.innerHTML = '<span class="sd"></span>workflow down';
    targetNode.querySelector(".badge").textContent = "error 401";
    targetNode.querySelector(".ds").textContent = "auth token expired · API change";
    if (timerEl) timerEl.textContent = "down 14h";
    if (flowBtn) flowBtn.innerHTML = "<span>▶</span> Run the fix";
    buildWires();
  }

  function setFixed() {
    isFixed = true;
    targetNode.classList.remove("shake");
    // brief "repairing" pulse
    stateBadge.className = "flow-state broken";
    stateBadge.innerHTML = '<span class="sd"></span>diagnosing…';
    let dots = 0;
    const diag = setInterval(() => {
      dots = (dots + 1) % 4;
      stateBadge.innerHTML = '<span class="sd"></span>repairing' + ".".repeat(dots);
    }, 220);

    setTimeout(() => {
      clearInterval(diag);
      stage.classList.add("is-fixed");
      stateBadge.className = "flow-state fixed";
      stateBadge.innerHTML = '<span class="sd"></span>all systems live';
      targetNode.querySelector(".badge").textContent = "200 OK";
      targetNode.querySelector(".ds").textContent = "token refreshed · retry + alerting";
      if (timerEl) timerEl.textContent = "uptime 100%";
      if (flowBtn) flowBtn.innerHTML = "<span>↻</span> Break it again";
      buildWires();
    }, 1100);
  }

  flowBtn?.addEventListener("click", () => {
    if (isFixed) setBroken();
    else setFixed();
  });

  // init
  function init() {
    buildWires();
    setBroken();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(animatePackets);
    // auto-fix once when it scrolls into view
    const seenIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            seenIO.disconnect();
            setTimeout(() => { if (!isFixed) setFixed(); }, 1600);
          }
        });
      },
      { threshold: 0.5 }
    );
    seenIO.observe(stage);
  }

  // wait for layout/fonts
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(init));
  } else {
    requestAnimationFrame(init);
  }
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(buildWires, 150);
  });
})();
