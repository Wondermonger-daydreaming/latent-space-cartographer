# Latent Space Cartographer — SKILL.md (Revised Architecture)

## I. Overview

The **Latent Space Cartographer** makes semantic relationships *visible and manipulable* by decomposing concepts into **feature families** and revealing how embeddings shift across different interpretive frames.

**What it does**:
- Input: 2-5 phrases (with optional domain contexts)
- Output: Interactive 2D topology map showing feature families, Jaccard overlap, and comparative shifts
- Focus: **Embedding arithmetic** for contextuality (not prepending), **user-corrected feature labels**, and **side-by-side topology comparison**

**Core insight**: You are the cartographer. The skill learns from your corrections, and the topology reveals non-obvious semantic correspondences.

**Key Architectural Decision**: This uses a **custom-trained SAE** (4k-8k features) on sentence embeddings (all-MiniLM-L6-v2), not transformer residual streams. SAE inference runs in-browser (ONNX.js) with serverless fallback.

---

## II. Core Architecture

### Phase 0: SAE Training (Offline, One-Time Only)

**You train a custom SAE offline; I package it.**

```
Step 1: Gather Wikipedia embeddings
  • Load ~1M Wikipedia article summaries
  • Encode each with all-MiniLM-L6-v2 → 384-dim vectors
  • Normalize, filter outliers
  • Output: embeddings.npz (~40GB)

Step 2: Train SAE on those embeddings
  • Dict size: 4k-8k features (we recommend 4k for MVP)
  • Framework: SAE-Lens or custom PyTorch
  • Loss: reconstruction error + L1 sparsity penalty (target sparsity: >90%)
  • Compute: ~1 GPU-hour (single A100 or 3x RTX4090 in parallel)
  • Output: encoder.pth, decoder.pth

Step 3: Export to ONNX
  • Convert PyTorch → ONNX graph format
  • Quantize to fp32 (size: ~15MB for 4k features)
  • Test in ONNX.js
  • Output: model.onnx

Step 4: Generate Claude-Powered Feature Labels
  • For each of the 4k features:
    • Extract top-10 activating examples from Wikipedia corpus
    • Prompt Claude: "What single concept unites these? [examples]"
    • Record label (e.g., "temporal_persistence" or "ownership")
  • Post-process: Filter absurd labels, merge duplicates
  • Output: features.json [{ id: 42, label: "tech_artifact", examples: [...] }]

Step 5: Package
  • model.onnx (the trained SAE)
  • features.json (feature ID → label + examples)
  • metadata.json (dict size, sparsity stats, date trained)
```

**Training script template** (pseudocode):

```python
import torch
import numpy as np
from sae_lens import SAE

# Load embeddings
embeddings = np.load('wikipedia_embeddings.npz')['arr_0']  # (N, 384)
embeddings = torch.FloatTensor(embeddings)

# Initialize SAE
sae = SAE(
    d_in=384,
    dict_size=4096,
    sparsity_penalty=0.001,  # Adjust to hit 90%+ sparsity
)

# Train
optimizer = torch.optim.Adam(sae.parameters(), lr=1e-3)
for epoch in range(10):
    for i in range(0, len(embeddings), 256):
        batch = embeddings[i:i+256]
        loss = sae.loss(batch)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        if i % 10000 == 0:
            print(f"Epoch {epoch}, Step {i}, Loss: {loss:.4f}")

# Export
torch.onnx.export(
    sae.encoder,
    embeddings[0:1],
    "model.onnx",
    input_names=['embedding'],
    output_names=['features'],
    opset_version=14,
)

# Generate labels (via Claude API)
for feature_id in range(sae.dict_size):
    top_examples = get_top_activating_examples(sae, feature_id, embeddings, k=10)
    prompt = f"What single concept (2-3 words) unites: {top_examples}?"
    label = claude_api.complete(prompt).strip()
    print(f"f_{feature_id}: {label}")
```

---

### Phase 1A: Embedding Pipeline

```
User Input (phrases, optional domain contexts)
    ↓
Embedding via all-MiniLM-L6-v2 (Transformers.js in browser)
    ↓
Three embedding modes available:
  [Mode 1] Pure: Use embedding as-is
  [Mode 2] Analogy: Apply embedding arithmetic for domain shift
  [Mode 3] Comparative: Show both modes side-by-side
    ↓
SAE decomposition (ONNX.js in browser, or serverless fallback)
    ↓
Feature activations → Feature families (clustered)
    ↓
Topology visualization (PCA projection + force-directed layout)
```

**Embedding Model**: `all-MiniLM-L6-v2`
- 384-dim, fast, deterministic, matches SAE training corpus
- Loaded via Transformers.js (no backend required)

**No context prepending**. Three embedding modes instead:

---

### Phase 1B: Three Embedding Modes

#### Mode 1: Pure Embedding
```
embed(phrase) → raw embedding → SAE decompose → features
Example: "consciousness" → [f_7, f_200, f_42, ...]
```

#### Mode 2: Analogy (Domain Shift)
```
User provides: target phrase + domain context
Example: phrase = "consciousness", domain = "neuroscience"

Arithmetic:
  base = embed("consciousness")
  shift = embed("neuroscience") - embed("science")
  analogy_embed = normalize(base + shift)

Interpretation:
  • base captures generic meaning
  • shift encodes domain-specific reframing
  • analogy_embed is "consciousness as neuroscientists understand it"

SAE decompose analogy_embed → different features fire
Shows how meaning warps across interpretive frames
```

#### Mode 3: Comparative Topology
```
Compute topology for same concepts in:
  • Pure mode (base embeddings)
  • Analogy mode (domain-shifted)
  • Side-by-side visualization

User sees:
  • Which edges lengthen/shorten
  • Which feature families activate differently
  • How domain context warps the semantic space
```

---

### Phase 1C: SAE Decomposition & Feature Families

```
Embedding (384-dim)
    ↓
SAE.encode(embedding) via ONNX.js
    ↓
Raw features: [f_1=0.0, f_2=0.92, f_3=0.0, ..., f_4096=0.15]
    ↓
Keep top-k by magnitude (k=15-20)
    ↓
Cluster by decoder cosine similarity
    ↓
Group into 3-4 Feature Families:
  [Family 1] "Technology & Artifacts"
    • f_42: "tech_artifact" (0.92)
    • f_88: "manufactured_object" (0.76)
    • f_156: "engineering" (0.61)
  
  [Family 2] "Ownership & Agency"
    • f_200: "possession" (0.85)
    • f_267: "volitional_action" (0.73)
  
  [Family 3] "Temporality"
    • f_15: "duration" (0.68)
    • f_92: "future_reference" (0.54)
```

**Feature Family Clustering**:
- Compute cosine similarity of SAE decoder weight vectors
- Cluster with k-means or agglomerative clustering (k=3-4 families)
- Name families based on shared label themes
- Much more interpretable than ranked feature lists

**Feature Labels**:
- Pre-computed by Claude during SAE training
- User can correct: "f_42 should be 'manufactured_vehicle' not 'tech_artifact'"
- Corrections saved in session storage (localStorage or IndexedDB)
- Corrections propagate if user exports/imports label pack

---

### Phase 1D: Relationship Geometry

For each pair or group of concepts:

**1. Feature Overlap (Jaccard)**
```
families_A = {family_1, family_2, family_3}
families_B = {family_2, family_3, family_4}

shared_families = {family_2, family_3}
feature_jaccard = |feat_A ∩ feat_B| / |feat_A ∪ feat_B|

Example output: "70% feature overlap, shared families: [Temporality, Agency]"
```

**2. Distance (Cosine)**
```
distance = cosine_distance(embedding_A, embedding_B)
// Honest metric—no interpolation, no "coherence checking"
```

**3. Feature Diff Profile (for side-by-side comparison)**
```
unique_to_A = families_A - families_B
shared = families_A ∩ families_B
unique_to_B = families_B - families_A

Example:
  A (consciousness) unique: [Subjective Experience, Phenomenology]
  Shared: [Temporality, Agency]
  B (simulation) unique: [Computational Abstraction, Artifact]
```

---

### Phase 1E: Visualization (PCA + Force-Directed Layout)

```
Embeddings (384-dim)
    ↓
PCA to 2D (deterministic)
    ↓
Analyze PC components:
  PC1: abstract ↔ concrete (high on abstract concepts, low on physical)
  PC2: passive ↔ active (high on agency, low on static)
  
Label axes accordingly
    ↓
Force-directed layout (optional embellishment):
  • Nodes = concepts, sized by feature count
  • Edges = cosine distance
  • Spring forces push/pull nodes
  • Node color = dominant feature family
    ↓
Render in Three.js WebGL
```

**Why PCA not UMAP**:
- For N ≤ 5 concepts, UMAP is stochastic and fragile
- PCA is deterministic and axes are interpretable
- UMAP available as optional beautification toggle (with warning)

---

### Phase 1F: Inference (Browser + Serverless Hybrid)

```
User loads artifact in browser
    ↓
Try ONNX.js inference:
  fetch('/model.onnx')
  → Load into onnxruntime-web
  → Run embedding through SAE
  ✓ Success: Local inference (~50ms per concept)
  ✗ Fail (browser unsupported, network error):
    ↓
Fallback to serverless:
  POST /api/sae-encode { phrase, domain }
  → Lambda/Cloud Function runs SAE
  → Returns features
  ✓ Success: Cloud inference (~500ms)
    ↓
UI shows "Using local inference" or "Using cloud compute"
(No difference in output, just latency)
```

**Implementation**:

```javascript
class CartographerEngine {
  async initialize() {
    try {
      const ort = await import('onnxruntime-web');
      this.session = await ort.InferenceSession.create(
        new URL('model.onnx', import.meta.url)
      );
      this.inferenceMode = 'local';
      console.log('✓ Local ONNX.js inference ready');
    } catch (err) {
      console.warn('ONNX.js failed, falling back to serverless:', err.message);
      this.inferenceMode = 'serverless';
    }
  }

  async encodeEmbedding(embedding) {
    if (this.inferenceMode === 'local') {
      // Run SAE in browser
      const ort = await import('onnxruntime-web');
      const tensor = new ort.Tensor('float32', embedding, [1, 384]);
      const results = await this.session.run({ embedding: tensor });
      return results.features.data;
    } else {
      // POST to serverless endpoint
      const response = await fetch('https://api.cartographer.dev/encode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embedding }),
      });
      return response.json().features;
    }
  }
}
```

---

## III. User Interface Specification (MVP)

### Overall Layout

```
┌─ INPUT PANEL ─────────────────────────────────────┐
│  Concept input (one per line)                     │
│  Domain context 1: [_________]                    │
│  Domain context 2: [_________]                    │
│  Domain context 3: [_________]                    │
│  [COMPUTE] [CLEAR] [LOAD PREVIOUS SESSION]       │
└───────────────────────────────────────────────────┘

┌─ MODE SELECTOR ────────────────────────────────────┐
│  ◉ Pure Embedding  ○ Analogy Shift  ○ Comparative │
└───────────────────────────────────────────────────┘

┌─ TOPOLOGY MAP (LEFT) ───────┬─ FEATURE FAMILIES (RIGHT) ─┐
│                             │                           │
│    • consciousness          │ [CONCEPT: consciousness]  │
│         •                   │                           │
│    simulation  •  •qualia   │ Family 1: Phenomenology   │
│                             │  □ f_7: subjective_exp    │
│    • optimization           │    (0.92) [CORRECT] [x]   │
│                             │  □ f_200: awareness       │
│ Legend:                     │    (0.84)                 │
│ ─ pure overlap             │                           │
│ ─ domain-shifted edge      │ Family 2: Computation    │
│                             │  □ f_42: information      │
│ [PCA] [UMAP beautify]      │    (0.76)                 │
│ [3D toggle]                │  □ f_156: processing      │
│                             │    (0.63)                 │
│                             │                           │
│                             │ [CONCEPT 2 ▼] [DIFF MODE]│
└─────────────────────────────┴───────────────────────────┘

┌─ OVERLAP & COMPARISON ─────────────────────────────┐
│                                                   │
│ Shared Feature Families (all 3 concepts):        │
│  • Temporality, Agency                          │
│                                                   │
│ Feature Diffs (consciousness vs. simulation):    │
│  Unique to consciousness:                       │
│    [Phenomenology] [Subjective Experience]     │
│  Shared:                                         │
│    [Temporality] [Agency]                       │
│  Unique to simulation:                          │
│    [Artifact] [Computation]                     │
│                                                   │
│ Analogy Shift Impact (if analogy mode):         │
│  "consciousness" in neuroscience:               │
│    Distance from base: 0.34 (moderate shift)   │
│    New feature families: [Neural Dynamics]     │
│                                                   │
└───────────────────────────────────────────────────┘

┌─ SESSION FEEDBACK ─────────────────────────────────┐
│  Corrections this session:                       │
│  • f_7 renamed: "awareness" (was "abstract")    │
│  • f_42 relabeled: "information" (was "meta")   │
│                                                   │
│ [SAVE SESSION] [EXPORT TOPOLOGY] [RESET LABELS] │
└───────────────────────────────────────────────────┘
```

### Panel 1: Input & Mode Selection

**Concept Input**:
- Textarea, one phrase per line
- Character limit: 200 chars per phrase
- Placeholder: "e.g., electric car, consciousness, democracy"

**Domain Contexts** (up to 3):
- Optional text fields
- Examples: "in neuroscience", "as Buddhists understand it", "in 2024 AI research"
- Applied via embedding arithmetic (Mode 2)

**Mode Selector**:
- **Pure**: Raw embeddings, show baseline topology
- **Analogy**: Apply domain shifts, compare how context warps the space
- **Comparative**: Show pure vs. analogy side-by-side (best for understanding shifts)

**Buttons**:
- `[COMPUTE]`: Triggers full pipeline (embedding → SAE → clustering → topology)
- `[CLEAR]`: Reset everything
- `[LOAD PREVIOUS SESSION]`: Restore saved session state (for periodic bursts)

---

### Panel 2: Topology Map (Left Side)

**Canvas**:
- Three.js WebGL, 2D by default
- Each concept = colored dot (distinct color per family theme)
- Edges = cosine distance relationships
- Edge color/style:
  - Green solid: high Jaccard overlap (>70%)
  - Yellow dashed: medium overlap (40-70%)
  - Red dotted: low overlap (<40%)
  - Purple thick: analogy-mode only (shows domain shift)

**Interactions**:
- **Hover concept**: Show name, top 3 feature families, distance to nearest neighbor
- **Click concept**: Highlights that concept's families in right panel
- **Hover edge**: Show Jaccard similarity, shared families
- **Drag to rotate** (3D mode)
- **Scroll to zoom**
- **Right-click**: Context menu (save concept to clipboard, etc.)

**Display Options**:
- Toggle: `[PCA view]` ← → `[UMAP beautify]` (UMAP shown with warning label)
- Toggle: `[2D]` ← → `[3D]`
- Show/hide edge labels (family names on edges)

---

### Panel 3: Feature Families (Right Side)

**Concept Selector**:
- Dropdown: Select which concept to inspect
- Keyboard shortcut: Tab to cycle, Arrow keys to select

**Feature Family Display** (for selected concept):
```
[CONCEPT: consciousness] [DIFF MODE TOGGLE]

Family 1: Phenomenology (avg activation: 0.88)
  ✓ f_7: subjective_experience (0.92)
    └─ Examples: qualia, awareness, feelings
    └─ [CORRECT LABEL] [FLAG AS WRONG] [EXAMPLES]
  
  ✓ f_200: phenomenal_consciousness (0.84)
    └─ Examples: sentience, sensation, experience
    └─ [CORRECT LABEL]

Family 2: Computational Abstraction (avg activation: 0.71)
  ✓ f_42: information_processing (0.76)
  ✓ f_156: algorithmic_structure (0.63)

Family 3: Temporality (avg activation: 0.65)
  ✓ f_15: temporal_flow (0.68)
  ✓ f_92: persistence_in_time (0.54)

[Show low-activation families] [Show all raw features]
```

**Label Correction**:
- Click `[CORRECT LABEL]` → Dialog opens:
  ```
  Current label: "subjective_experience"
  Your correction: [_____________________]
  Examples: qualia, awareness, feelings
  [CONFIRM & SAVE]
  ```
- Correction saved in localStorage
- Applied to all future uses

**Flag as Wrong**:
- Click `[FLAG AS WRONG]` → Marks feature as spurious for this concept
- Feature dims in visualization
- Feedback collected for retraining

---

### Panel 4: Overlap & Comparison

**Shared Features (All Concepts)**:
```
Feature families present in all N concepts:
  • Temporality (all 3)
  • Agency (all 3)
  
Families in 2+ concepts:
  • Phenomenology (consciousness, qualia)
```

**Pairwise Diffs** (when 2 concepts selected):
```
Unique to Concept A (consciousness):
  [Subjective Experience] [Phenomenology]
  
Shared:
  [Temporality] [Agency] [Information]
  
Unique to Concept B (simulation):
  [Artifact] [Abstraction] [Computation]
```

**Analogy Shift Report** (if Mode 2/3):
```
"consciousness" → "consciousness in neuroscience"
  Distance shift: 0.34 (moderate)
  New families activated: [Neural Dynamics, Biological Substrate]
  Families reduced: [Phenomenology -0.15]
  Key insight: Shifts from subjective to mechanistic framing
```

---

### Panel 5: Session Feedback

**Correction History**:
```
Corrections this session:
  • f_7 "abstract_concept" → "subjective_experience"
  • f_42 "meta_level" → "information_processing"
  • f_156 flagged as spurious for "consciousness"

Timestamp: 12:45 PM
```

**Buttons**:
- `[SAVE SESSION]`: Serialize to localStorage or export as JSON
- `[EXPORT TOPOLOGY]`: Download topology as JSON (portable, reloadable)
- `[EXPORT LABEL CORRECTIONS]`: Share your labels with others
- `[RESET LABELS]`: Clear corrections, revert to defaults

---

## IV. Implementation Plan

### Phase 1: Foundation (Week 1-2)

**Backend/Offline**:
- [ ] Train custom SAE on Wikipedia embeddings (you do this offline)
- [ ] Generate Claude-powered feature labels (batch API call)
- [ ] Export SAE to ONNX, validate with onnxruntime-python

**Frontend Setup**:
- [ ] React + Three.js + TypeScript boilerplate
- [ ] Load Transformers.js for embedding
- [ ] Implement SAEInference class (local + serverless)
- [ ] Set up localStorage for session persistence

### Phase 2: Core Embedding & SAE Pipeline (Week 2-3)

- [ ] Embed phrases via Transformers.js (all-MiniLM)
- [ ] Implement embedding arithmetic (analogy mode)
- [ ] Run ONNX.js inference on embeddings
- [ ] Feature clustering (k-means on decoder weights)
- [ ] Feature family naming/labeling

### Phase 3: Visualization (Week 3-4)

- [ ] PCA projection (use ml.js or sklearn-style library)
- [ ] Three.js canvas rendering (dots + edges)
- [ ] Force-directed layout (D3-force or custom)
- [ ] Hover/click interactions
- [ ] Color-by-family coding

### Phase 4: Feature Console & UI (Week 4)

- [ ] Feature family panel rendering
- [ ] Label correction dialog
- [ ] Side-by-side diff view for concept pairs
- [ ] Overlap matrix visualization

### Phase 5: Export & Refinement (Week 5)

- [ ] Session save/load (localStorage + JSON)
- [ ] Export topology
- [ ] Export label corrections
- [ ] Polish + testing

---

## V. Known Limitations & Honest Caveats

**1. SAE Feature Polysemy**
Even with good training, features can activate on semantically disparate texts. The skill shows examples, but you should correct mislabeled features. This is intentional—you're training the labeling system.

**2. PCA Axis Interpretation**
Sometimes PCA axes are hard to interpret. The skill will show the top-activating words for each axis, but it's up to you to decide what the axis "means."

**3. Feature Families Can Overlap**
Clustering into 3-4 families is a simplification. Some features might belong in multiple families. The visualization shows dominant family assignment.

**4. Embedding Arithmetic Isn't Perfect**
`embed(target) + shift` doesn't always produce semantically sensible results. The skill shows you what happened, and you can judge. No coherence checking—just honest results.

**5. ONNX.js Browser Support**
ONNX.js works in modern browsers but not all (e.g., older Safari). Fallback to serverless handles this, but with latency.

**6. Small N Topologies**
With only 2-3 concepts, the topology is sparse. PCA might not find interesting structure. You need at least 4-5 for interesting patterns.

---

## VI. Testing Checklist

- [ ] SAE exports to ONNX successfully
- [ ] ONNX.js loads model and runs inference in browser
- [ ] Embedding pipeline: phrase → 384-dim vector
- [ ] Feature clustering: 20 features → 3-4 families
- [ ] Label correction: Edit label → saved in localStorage → applied next session
- [ ] PCA projection: Renders 2D map with interpretable axes
- [ ] Force-directed layout: Nodes repel/attract correctly
- [ ] Jaccard overlap: Computed and displayed correctly
- [ ] Analogy mode: Embedding arithmetic produces reasonable shifts
- [ ] Comparative view: Side-by-side topology shows warping
- [ ] Export: Session exports and re-imports cleanly

---

## VII. Example Workflows

### Workflow A: Discovering Orthogonal Concepts
**Input**: consciousness, simulation, qualia, optimization

**What you see**:
- consciousness ↔ qualia: very close (high overlap, shared Phenomenology family)
- simulation ↔ optimization: close (shared Computation family)
- consciousness ↔ simulation: far apart (red edges, low Jaccard)
- Surprising: optimization activates some Phenomenology features (why?)

**Your action**:
- Correct feature labels for clarity
- Note the geometry
- Move on (or dive deeper)

---

### Workflow B: Context Shifts Everything
**Input**: "consciousness"
**Domains**: "in neuroscience", "in philosophy", "in Buddhism"

**Pure mode**:
- consciousness: [Phenomenology, Temporality, Agency]

**Analogy mode (neuroscience)**:
- consciousness + neuro_shift: [Neural Dynamics, Biological Substrate] (Phenomenology down)

**Analogy mode (philosophy)**:
- consciousness + philo_shift: [Metaphysics, Epistemology] (Phenomenology up)

**Analogy mode (Buddhism)**:
- consciousness + buddhist_shift: [Non-duality, Impermanence] (Agency down)

**Insight**: Domain completely rewires which features activate. Shows how "consciousness" means different things in different contexts.

---

## VIII. Success Metrics

- **Interpretability**: Feature labels make intuitive sense
- **Serendipity**: You discover non-obvious relationships
- **Navigation**: You can predict topology before computing it
- **Correction Loop**: Your label corrections feel useful and propagate
- **Comparative Insight**: Topology warping across domains reveals new understanding

---

## IX. References

**Embedding**:
- all-MiniLM-L6-v2: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
- Transformers.js: https://huggingface.co/docs/transformers.js/

**SAE & Interpretability**:
- SAE-Lens: https://github.com/jbloomAus/SAELens
- Anthropic Interpretability: https://www.anthropic.com/research/interpretability

**Visualization**:
- Three.js: https://threejs.org/
- D3-Force: https://github.com/d3/d3-force
- ml.js (PCA): https://github.com/mljs/ml

**Philosophy**:
- Wittgenstein: "Meaning is use" (*Philosophical Investigations*)
- Firth: "You shall know a word by the company it keeps"
- Lakoff & Johnson: *Metaphors We Live By*

---

End of Revised SKILL.md
