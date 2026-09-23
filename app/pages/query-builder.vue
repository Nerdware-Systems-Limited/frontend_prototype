<template>
  <PageHeader
    eyebrow="Ad-hoc Query Engine"
    title="Query Builder"
    subtitle="Browse the gisdb schema, compose a query visually or in raw SQL, preview it, and run it"
  >
    <template #actions>
      <button class="btn-primary" :disabled="!canRun || busy" @click="runQuery">
        <Play :size="14" /> {{ busy ? 'Running…' : 'Run Query' }}
      </button>
    </template>
  </PageHeader>

  <div class="qb-grid" :class="{ 'is-max': resultsMaximized }">
    <!-- ═══════════════ SCHEMA BROWSER ═══════════════ -->
    <section class="qb-col col-schema">
      <header class="qb-col-head">
        <span class="qb-col-label">Schema Browser</span>
        <button class="icon-btn" title="Reload schema" :disabled="loadingSchema" @click="loadSchema">
          <RefreshCw :size="13" :class="{ spin: loadingSchema }" />
        </button>
      </header>

      <div class="qb-col-scroll">
        <div class="tree-search">
          <Search :size="13" />
          <input v-model="schemaSearch" type="text" placeholder="Search tables and columns…" />
          <button v-if="schemaSearch" class="tree-search-x" @click="schemaSearch = ''"><X :size="12" /></button>
        </div>

        <div v-if="loadingSchema" class="tree-hint">Loading schema…</div>
        <div v-else-if="!consoleAvailable" class="tree-note"><Lock :size="12" /> {{ consoleMessage }}</div>

        <template v-else>
          <button class="tree-row lvl-0" @click="toggleNode(PG_ID)">
            <component :is="nodeOpen(PG_ID) ? ChevronDown : ChevronRight" :size="13" class="tree-caret" />
            <Database :size="13" class="tree-ic ic-db" />
            <span class="tree-name">{{ dbName || 'database' }}</span>
            <span class="tree-badge">{{ dbSchema.length }}</span>
          </button>

          <template v-if="nodeOpen(PG_ID)">
            <div v-if="!dbTree.length" class="tree-hint sub">No tables match “{{ schemaSearch }}”.</div>
            <template v-for="g in dbTree" :key="g.id">
              <button class="tree-row lvl-1" @click="toggleNode(g.id)">
                <component :is="nodeOpen(g.id) ? ChevronDown : ChevronRight" :size="13" class="tree-caret" />
                <Layers :size="13" class="tree-ic ic-schema" />
                <span class="tree-name">{{ g.schema }}</span>
                <span class="tree-badge">{{ g.tables.length }}</span>
              </button>

              <template v-if="nodeOpen(g.id)">
                <template v-for="t in g.tables" :key="t.schema + '.' + t.name">
                  <div class="tree-row lvl-2" :class="{ active: activeTableKey === t.schema + '.' + t.name }">
                    <button class="tree-caret-btn" @click="toggleNode(tableId(t))">
                      <component :is="nodeOpen(tableId(t)) ? ChevronDown : ChevronRight" :size="13" />
                    </button>
                    <button
                      class="tree-row-main"
                      :title="`${t.kind} · ~${t.estimated_rows.toLocaleString()} rows · ${t.size_pretty}`"
                      @click="selectTable(t)"
                    >
                      <component :is="t.kind === 'table' || t.kind === 'partitioned_table' ? Table2 : Braces" :size="13" class="tree-ic ic-table" />
                      <span class="tree-name mono">{{ t.name }}</span>
                      <span v-if="t.kind !== 'table'" class="tree-kind">{{ t.kind === 'materialized_view' ? 'matview' : t.kind }}</span>
                      <span class="tree-badge">{{ t.columns.length }}</span>
                    </button>
                  </div>

                  <template v-if="nodeOpen(tableId(t))">
                    <button
                      v-for="c in t.columns"
                      :key="c.name"
                      class="tree-col"
                      :class="{ picked: activeTableKey === t.schema + '.' + t.name && builderMode === 'visual' && isFieldChosen(c.name) }"
                      @click="onColumnClick(t, c)"
                    >
                      <component :is="c.is_pk ? KeyRound : dbColIcon(c)" :size="12" class="tree-col-ic" />
                      <span class="tree-col-name">{{ c.name }}</span>
                      <span class="tree-col-type">{{ c.data_type }}</span>
                    </button>
                  </template>
                </template>
              </template>
            </template>
          </template>
        </template>
      </div>

      <footer class="qb-col-foot">
        <button class="foot-btn" @click="resetBuilder"><Plus :size="13" /> New Query</button>
      </footer>
    </section>

    <!-- ═══════════════ QUERY BUILDER ═══════════════ -->
    <section class="qb-col col-builder">
      <header class="qb-col-head">
        <span class="qb-col-label">Query Builder</span>
        <div v-if="consoleAvailable" class="mode-toggle">
          <button :class="{ on: builderMode === 'visual' }" @click="builderMode = 'visual'">Visual</button>
          <button :class="{ on: builderMode === 'sql' }" @click="builderMode = 'sql'">SQL</button>
        </div>
      </header>

      <div class="qb-col-scroll">
        <!-- ───────── VISUAL MODE ───────── -->
        <template v-if="builderMode === 'visual'">
          <!-- Command picker -->
          <div class="cmd-bar">
            <select v-model="command" class="ctl cmd-sel">
              <optgroup label="Query">
                <option value="SELECT">SELECT</option>
              </optgroup>
              <optgroup label="Modify rows">
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </optgroup>
              <optgroup label="Schema (DDL)">
                <option value="CREATE">CREATE TABLE</option>
                <option value="ALTER">ALTER TABLE</option>
                <option value="TRUNCATE">TRUNCATE</option>
                <option value="DROP">DROP TABLE</option>
              </optgroup>
            </select>
            <label v-if="command !== 'SELECT'" class="dry-chk" :class="{ warn: !visualDryRun }">
              <input type="checkbox" v-model="visualDryRun" />
              <component :is="visualDryRun ? Lock : TriangleAlert" :size="12" />
              {{ visualDryRun ? 'Dry run (rollback)' : 'Will commit' }}
            </label>
          </div>

          <div v-if="needsTable && !currentTable" class="qc">
            <div class="qc-body"><div class="qc-empty">Pick a table in the schema browser to run {{ command }}.</div></div>
          </div>

          <template v-else>
            <!-- ══ SELECT ══ -->
            <div v-if="command === 'SELECT'" ref="selectCardRef" class="qc">
              <div class="qc-head">
                <span class="qc-title">Select</span>
                <button class="qc-add" @click="onSelectPlus"><Plus :size="14" /></button>
              </div>
              <div class="qc-body">
                <div class="chips">
                  <template v-if="selectAll">
                    <span class="chip">
                      <Columns3 :size="12" /> * (all columns)
                      <button class="chip-x" title="Choose specific columns" @click="customizeColumns"><X :size="11" /></button>
                    </span>
                  </template>
                  <template v-else>
                    <span v-for="c in selectedFields" :key="c" class="chip">
                      {{ c }}
                      <button class="chip-x" @click="removeField(c)"><X :size="11" /></button>
                    </span>
                    <span v-if="!selectedFields.length" class="qc-empty sm">No columns picked — switching back to *.</span>
                    <button class="chip chip-add" @click="selectMenuOpen = !selectMenuOpen"><Plus :size="11" /> column</button>
                  </template>

                  <div v-if="selectMenuOpen" class="menu">
                    <button class="menu-item" @click="useAllColumns"><Columns3 :size="12" /> All columns (*)</button>
                    <div class="menu-sep" />
                    <button v-for="f in addableFields" :key="f.name" class="menu-item" @click="addField(f.name)">
                      <component :is="fieldIcon(f)" :size="12" /> {{ f.name }}
                    </button>
                    <div v-if="!addableFields.length" class="menu-empty">Every column is already selected.</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ══ INSERT — values ══ -->
            <div v-else-if="command === 'INSERT'" class="qc">
              <div class="qc-head">
                <span class="qc-title">Values</span>
                <button class="qc-add" @click="addKv('insert')"><Plus :size="14" /></button>
              </div>
              <div class="qc-body">
                <div v-if="!insertRows.length" class="qc-empty sm">Add a column to set a value for.</div>
                <div v-for="r in insertRows" :key="r.id" class="kv-row">
                  <select v-model="r.column" class="ctl">
                    <option value="">column…</option>
                    <option v-for="df in tableFields" :key="df.name" :value="df.name">{{ df.name }}</option>
                  </select>
                  <input v-model="r.value" class="ctl" :type="inputTypeFor(r.column)" placeholder="value · blank = NULL" />
                  <button class="frow-x" title="Remove" @click="removeKv('insert', r.id)"><X :size="13" /></button>
                </div>
                <button class="add-line" @click="addKv('insert')"><Plus :size="13" /> Add column</button>
              </div>
            </div>

            <!-- ══ UPDATE — SET ══ -->
            <div v-else-if="command === 'UPDATE'" class="qc">
              <div class="qc-head">
                <span class="qc-title">Set</span>
                <button class="qc-add" @click="addKv('set')"><Plus :size="14" /></button>
              </div>
              <div class="qc-body">
                <div v-if="!setRows.length" class="qc-empty sm">Add a column = value assignment.</div>
                <div v-for="r in setRows" :key="r.id" class="kv-row">
                  <select v-model="r.column" class="ctl">
                    <option value="">column…</option>
                    <option v-for="df in tableFields" :key="df.name" :value="df.name">{{ df.name }}</option>
                  </select>
                  <input v-model="r.value" class="ctl" :type="inputTypeFor(r.column)" placeholder="value · blank = NULL" />
                  <button class="frow-x" title="Remove" @click="removeKv('set', r.id)"><X :size="13" /></button>
                </div>
                <button class="add-line" @click="addKv('set')"><Plus :size="13" /> Add assignment</button>
              </div>
            </div>

            <!-- ══ TRUNCATE ══ -->
            <div v-else-if="command === 'TRUNCATE'" class="qc">
              <div class="qc-head"><span class="qc-title">Options</span></div>
              <div class="qc-body opts">
                <label class="chk"><input type="checkbox" v-model="truncRestartId" /> RESTART IDENTITY</label>
                <label class="chk"><input type="checkbox" v-model="truncCascade" /> CASCADE</label>
              </div>
            </div>

            <!-- ══ DROP ══ -->
            <div v-else-if="command === 'DROP'" class="qc">
              <div class="qc-head"><span class="qc-title">Options</span></div>
              <div class="qc-body opts">
                <label class="chk"><input type="checkbox" v-model="dropIfExists" /> IF EXISTS</label>
                <label class="chk"><input type="checkbox" v-model="dropCascade" /> CASCADE</label>
              </div>
            </div>

            <!-- ══ CREATE TABLE ══ -->
            <template v-else-if="command === 'CREATE'">
              <div class="qc">
                <div class="qc-head"><span class="qc-title">Table</span></div>
                <div class="qc-body">
                  <div class="kv-row two">
                    <input v-model="newTableName" class="ctl" placeholder="new_table_name" />
                    <label class="chk"><input type="checkbox" v-model="createIfNotExists" /> IF NOT EXISTS</label>
                  </div>
                  <p class="qc-note">Created in schema <code>public</code>.</p>
                </div>
              </div>
              <div class="qc">
                <div class="qc-head">
                  <span class="qc-title">Columns</span>
                  <button class="qc-add" @click="addCreateCol"><Plus :size="14" /></button>
                </div>
                <div class="qc-body">
                  <div v-if="!createCols.length" class="qc-empty sm">Add at least one column.</div>
                  <div v-for="c in createCols" :key="c.id" class="col-def">
                    <input v-model="c.name" class="ctl" placeholder="column name" />
                    <input v-model="c.type" class="ctl" list="pgTypes" placeholder="type (e.g. text, integer, uuid)" />
                    <input v-model="c.default" class="ctl" placeholder="default (optional, e.g. now())" />
                    <div class="cd-opts">
                      <label class="chk sm"><input type="checkbox" v-model="c.pk" /> primary key</label>
                      <label class="chk sm"><input type="checkbox" v-model="c.nullable" /> nullable</label>
                      <button class="frow-x" title="Remove" @click="removeCreateCol(c.id)"><X :size="13" /></button>
                    </div>
                  </div>
                  <button class="add-line" @click="addCreateCol"><Plus :size="13" /> Add column</button>
                </div>
              </div>
            </template>

            <!-- ══ ALTER TABLE ══ -->
            <div v-else-if="command === 'ALTER'" class="qc">
              <div class="qc-head"><span class="qc-title">Change</span></div>
              <div class="qc-body">
                <select v-model="alterAction" class="ctl">
                  <option value="ADD_COLUMN">Add column</option>
                  <option value="DROP_COLUMN">Drop column</option>
                  <option value="RENAME_COLUMN">Rename column</option>
                  <option value="RENAME_TABLE">Rename table</option>
                  <option value="SET_NOT_NULL">Set NOT NULL</option>
                  <option value="DROP_NOT_NULL">Drop NOT NULL</option>
                  <option value="SET_DEFAULT">Set default</option>
                  <option value="DROP_DEFAULT">Drop default</option>
                </select>

                <div class="alter-fields">
                  <template v-if="alterAction === 'ADD_COLUMN'">
                    <input v-model="alterColName" class="ctl" placeholder="new column name" />
                    <input v-model="alterColType" class="ctl" list="pgTypes" placeholder="type" />
                    <label class="chk sm"><input type="checkbox" v-model="alterColNullable" /> nullable</label>
                    <input v-model="alterColDefault" class="ctl" placeholder="default (optional)" />
                  </template>

                  <template v-else-if="alterAction === 'RENAME_TABLE'">
                    <input v-model="alterNewName" class="ctl" placeholder="new table name" />
                  </template>

                  <template v-else>
                    <select v-model="alterTargetCol" class="ctl">
                      <option value="">column…</option>
                      <option v-for="df in tableFields" :key="df.name" :value="df.name">{{ df.name }}</option>
                    </select>
                    <input
                      v-if="alterAction === 'RENAME_COLUMN'"
                      v-model="alterNewName" class="ctl" placeholder="new column name"
                    />
                    <input
                      v-else-if="alterAction === 'SET_DEFAULT'"
                      v-model="alterColDefault" class="ctl" placeholder="default expression"
                    />
                    <label v-else-if="alterAction === 'DROP_COLUMN'" class="chk sm">
                      <input type="checkbox" v-model="alterCascade" /> CASCADE
                    </label>
                  </template>
                </div>
              </div>
            </div>

            <!-- ══ WHERE (SELECT / UPDATE / DELETE) ══ -->
            <div v-if="showWhere" class="qc">
              <div class="qc-head">
                <span class="qc-title">Where</span>
                <div class="qc-head-right">
                  <div v-if="filters.length > 1" class="andor">
                    <button :class="{ on: filterConjunction === 'AND' }" @click="filterConjunction = 'AND'">AND</button>
                    <button :class="{ on: filterConjunction === 'OR' }" @click="filterConjunction = 'OR'">OR</button>
                  </div>
                  <button class="qc-add" @click="addFilter"><Plus :size="14" /></button>
                </div>
              </div>
              <div class="qc-body">
                <div v-if="!filters.length" class="qc-empty sm">
                  {{ command === 'SELECT' ? 'No filters — every row is returned.' : 'No WHERE — affects every row.' }}
                </div>

                <template v-for="(f, idx) in filters" :key="f.id">
                  <div v-if="idx > 0" class="frow-conj">{{ filterConjunction }}</div>
                  <div class="frow">
                    <select v-model="f.field" class="ctl">
                      <option value="">column…</option>
                      <option v-for="df in tableFields" :key="df.name" :value="df.name">{{ df.name }}</option>
                    </select>
                    <select v-model="f.op" class="ctl op">
                      <option v-for="op in OPS" :key="op.value" :value="op.value">{{ op.label }}</option>
                    </select>
                    <div v-if="f.op === 'between'" class="between">
                      <input v-model="f.value2[0]" class="ctl" :type="inputTypeFor(f.field)" placeholder="from" />
                      <span>–</span>
                      <input v-model="f.value2[1]" class="ctl" :type="inputTypeFor(f.field)" placeholder="to" />
                    </div>
                    <input
                      v-else v-model="f.value" class="ctl"
                      :type="f.op === 'in' || f.op === 'contains' ? 'text' : inputTypeFor(f.field)"
                      :placeholder="f.op === 'in' ? 'a, b, c' : 'value…'"
                    />
                    <button class="frow-x" title="Remove" @click="removeFilter(f.id)"><X :size="13" /></button>
                  </div>
                </template>

                <button class="add-line" @click="addFilter"><Plus :size="13" /> Add condition</button>
              </div>
            </div>

            <!-- ══ ORDER BY / LIMIT (SELECT only) ══ -->
            <template v-if="command === 'SELECT'">
              <div class="qc">
                <div class="qc-head">
                  <span class="qc-title">Order By</span>
                  <button class="qc-add" @click="addSort"><Plus :size="14" /></button>
                </div>
                <div class="qc-body">
                  <div v-if="!sorts.length" class="qc-empty sm">Unordered.</div>
                  <div v-for="s in sorts" :key="s.id" class="frow sort">
                    <select v-model="s.field" class="ctl">
                      <option value="">column…</option>
                      <option v-for="df in tableFields" :key="df.name" :value="df.name">{{ df.name }}</option>
                    </select>
                    <select v-model="s.direction" class="ctl dir">
                      <option value="asc">ASC</option>
                      <option value="desc">DESC</option>
                    </select>
                    <button class="frow-x" title="Remove" @click="removeSort(s.id)"><X :size="13" /></button>
                  </div>
                  <button class="add-line" @click="addSort"><Plus :size="13" /> Add sort</button>
                </div>
              </div>

              <div class="qc">
                <div class="qc-head">
                  <span class="qc-title">Limit</span>
                  <button class="qc-add" :disabled="limitEnabled" @click="limitEnabled = true"><Plus :size="14" /></button>
                </div>
                <div class="qc-body">
                  <div v-if="!limitEnabled" class="qc-empty sm">No cap — click + to limit the result set.</div>
                  <div v-else class="limit-row">
                    <input v-model.number="limitValue" type="number" min="1" step="50" class="ctl" />
                    <span class="limit-unit">rows max</span>
                    <button class="frow-x" title="Remove limit" @click="limitEnabled = false"><X :size="13" /></button>
                  </div>
                </div>
              </div>
            </template>

            <datalist id="pgTypes">
              <option v-for="ty in PG_TYPES" :key="ty" :value="ty" />
            </datalist>

            <div v-if="dangerNote" class="warn-line" :class="{ danger: !visualDryRun && command !== 'SELECT' }">
              <TriangleAlert :size="13" /> {{ dangerNote }}
            </div>

            <!-- SQL PREVIEW -->
            <div class="sqlc">
              <div class="sqlc-head">
                <span class="sqlc-title">SQL Preview</span>
                <div class="sqlc-actions">
                  <button class="sqlc-copy" @click="editAsSql"><Pencil :size="12" /> Edit as SQL</button>
                  <button class="sqlc-copy" @click="copySql">
                    <component :is="sqlCopied ? Check : Copy" :size="12" />
                    {{ sqlCopied ? 'Copied' : 'Copy' }}
                  </button>
                </div>
              </div>
              <div class="sqlc-body">
                <div v-for="(ln, i) in sqlLines" :key="i" class="sql-ln">
                  <span class="sql-gutter">{{ i + 1 }}</span>
                  <span class="sql-code" v-html="ln" />
                </div>
              </div>
            </div>
          </template>
        </template>

        <!-- ───────── SQL MODE ───────── -->
        <template v-else>
          <div class="sqled">
            <div class="sqled-toolbar">
              <label class="sqled-chk" :class="{ warn: !sqlReadOnly }">
                <input type="checkbox" v-model="sqlReadOnly" />
                <component :is="sqlReadOnly ? Lock : TriangleAlert" :size="12" />
                {{ sqlReadOnly ? 'Read-only (rolled back)' : 'Writes will commit' }}
              </label>
              <label class="sqled-rows">
                max rows
                <input v-model.number="sqlMaxRows" type="number" min="1" max="10000" step="100" class="ctl" />
              </label>
            </div>

            <div class="sqled-wrap">
              <div class="sqled-gutter">
                <div :style="{ transform: `translateY(${-gutterTop}px)` }">
                  <span v-for="n in sqlLineCount" :key="n">{{ n }}</span>
                </div>
              </div>
              <textarea
                ref="sqlEditorRef"
                v-model="sqlDraft"
                class="sqled-area"
                spellcheck="false"
                autocapitalize="off"
                autocomplete="off"
                placeholder="SELECT * FROM tbl_users ORDER BY created_at DESC LIMIT 50;"
                @keydown="onSqlKeydown"
                @scroll="gutterTop = ($event.target as HTMLElement).scrollTop"
              />
            </div>

            <div v-if="rawError" class="qb-error">
              <TriangleAlert :size="13" />
              <span>{{ rawError }}<span v-if="rawSqlState" class="sqlstate">SQLSTATE {{ rawSqlState }}</span></span>
            </div>

            <p class="sqled-note">
              <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>↵</kbd> runs. The whole script executes in one
              transaction against <strong>{{ dbName || 'the database' }}</strong> — unrestricted, DDL included.
              Every run is audit-logged.
            </p>
          </div>
        </template>
      </div>
    </section>

    <!-- ═══════════════ RESULTS ═══════════════ -->
    <section class="qb-col col-result">
      <header class="qb-col-head res-head">
        <div class="res-head-l">
          <span class="qb-col-label">Results</span>
          <div class="res-meta">
            <template v-if="isAffected">
              <template v-if="affectedIsDml"><strong>{{ fmtNum(rawResult?.rowcount ?? 0) }}</strong> rows affected</template>
              <strong v-else>Statement executed</strong>
              <span class="dot">·</span>
              {{ displayElapsed }}
              <span v-if="rawResult?.read_only" class="res-flash rolled"><RotateCcw :size="12" /> rolled back</span>
            </template>
            <template v-else-if="hasResult">
              <strong>{{ fmtNum(displayTotal) }}</strong> rows
              <span class="dot">·</span>
              {{ displayElapsed }}
              <span v-if="rawResult?.read_only" class="res-flash rolled"><RotateCcw :size="12" /> read-only</span>
              <span v-if="flashMsg" class="res-flash"><Check :size="12" /> {{ flashMsg }}</span>
            </template>
            <template v-else>Run a query to see results</template>
          </div>
        </div>
        <div class="res-head-r">
          <div ref="exportRef" class="split">
            <button class="btn" :disabled="!canExport" @click="exportCSV">
              <Download :size="13" /> Export CSV
            </button>
            <button class="btn split-caret" :disabled="!canExport" @click="exportMenuOpen = !exportMenuOpen">
              <ChevronDown :size="13" />
            </button>
            <div v-if="exportMenuOpen" class="menu menu-right">
              <button class="menu-item" @click="exportCSV(); exportMenuOpen = false"><Download :size="12" /> Export CSV</button>
              <button class="menu-item" @click="exportJSON(); exportMenuOpen = false"><Braces :size="12" /> Export JSON</button>
            </div>
          </div>
          <button class="icon-btn" :title="resultsMaximized ? 'Restore layout' : 'Maximize results'" @click="resultsMaximized = !resultsMaximized">
            <component :is="resultsMaximized ? Minimize2 : Maximize2" :size="14" />
          </button>
        </div>
      </header>

      <div class="qb-col-scroll res-scroll">
        <div v-if="busy" class="res-state"><div class="spinner" /><span>Executing query…</span></div>

        <div v-else-if="rawError && !rawResult" class="res-state err">
          <TriangleAlert :size="26" /><span>{{ rawError }}</span>
        </div>

        <div v-else-if="!hasResult" class="res-state">
          <Table2 :size="28" />
          <span v-if="builderMode === 'sql'">Write SQL, then Run Query (⌘/Ctrl + ↵).</span>
          <span v-else-if="command === 'CREATE'">Define the table, then Run Query.</span>
          <span v-else-if="currentTable">Build the {{ command }}, then Run Query.</span>
          <span v-else>Pick a table from the schema browser.</span>
        </div>

        <div v-else-if="isAffected" class="affected">
          <div class="affected-head">
            <Check :size="18" />
            <div>
              <div class="affected-n">
                <template v-if="affectedIsDml">{{ fmtNum(rawResult?.rowcount ?? 0) }} row{{ (rawResult?.rowcount ?? 0) === 1 ? '' : 's' }} affected</template>
                <template v-else>Statement executed successfully</template>
              </div>
              <div class="affected-sub">
                {{ (rawResult?.statements ?? []).map(s => s.command).join(' → ') }}
                <template v-if="rawResult?.read_only"> · rolled back (dry run)</template>
              </div>
            </div>
          </div>
          <table class="stmt-table">
            <thead><tr><th>#</th><th>command</th><th>rows</th><th>statement</th></tr></thead>
            <tbody>
              <tr v-for="(s, i) in rawResult?.statements ?? []" :key="i">
                <td>{{ i + 1 }}</td>
                <td><span class="pill pill-info">{{ s.command }}</span></td>
                <td>{{ s.rowcount < 0 ? '—' : s.rowcount }}</td>
                <td class="stmt-sql">{{ s.sql }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="!displayRows.length" class="res-state"><span>No rows returned.</span></div>

        <template v-else>
          <div v-if="rawResult?.truncated" class="trunc-banner">
            <TriangleAlert :size="12" />
            Showing the first {{ fmtNum(rawResult?.rows.length ?? 0) }} rows — raise the limit / “max rows” to fetch more.
          </div>
          <table class="res-table">
            <thead>
              <tr>
                <th v-for="col in displayColumns" :key="col" @click="sortByColumn(col)">
                  <span>{{ col }}</span>
                  <ArrowDownUp v-if="sortDirFor(col) === ''" :size="11" class="th-ic dim" />
                  <ChevronUp v-else-if="sortDirFor(col) === 'asc'" :size="12" class="th-ic" />
                  <ChevronDown v-else :size="12" class="th-ic" />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in displayRows" :key="i">
                <td v-for="col in displayColumns" :key="col">
                  <span v-if="row[col] === null || row[col] === undefined" class="c-null">—</span>
                  <span v-else-if="isPillCol(col)" class="pill" :class="'pill-' + pillVariant(row[col])">{{ row[col] }}</span>
                  <span v-else-if="isUuidCol(col)" class="c-mono" :title="String(row[col])">{{ String(row[col]) }}</span>
                  <span v-else-if="isDateCol(col)" class="c-mono">{{ fmtDate(row[col]) }}</span>
                  <span v-else :title="String(row[col])">{{ formatCell(row[col]) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>

      <footer v-if="hasResult && !isAffected && displayRows.length" class="res-pager">
        <label class="pg-size">
          Rows per page:
          <select v-model.number="pageSize" class="ctl">
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="250">250</option>
          </select>
        </label>
        <div class="pg-nav">
          <button class="pg" :disabled="page <= 1" @click="goToPage(1)"><ChevronFirst :size="14" /></button>
          <button class="pg" :disabled="page <= 1" @click="goToPage(page - 1)"><ChevronLeft :size="14" /></button>
          <button
            v-for="(n, i) in pageNumbers" :key="i"
            class="pg" :class="{ active: n === page, gap: n === '…' }"
            :disabled="n === '…'"
            @click="typeof n === 'number' && goToPage(n)"
          >{{ n }}</button>
          <button class="pg" :disabled="page >= totalPages" @click="goToPage(page + 1)"><ChevronRight :size="14" /></button>
          <button class="pg" :disabled="page >= totalPages" @click="goToPage(totalPages)"><ChevronLast :size="14" /></button>
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  Play, Search, RefreshCw, Plus, X, Pencil, Lock, RotateCcw,
  Database, Layers, Table2, KeyRound, Hash, CalendarClock, Type, List, Columns3,
  ChevronRight, ChevronDown, ChevronUp, ChevronLeft, ChevronFirst, ChevronLast,
  Copy, Check, Download, Braces, Maximize2, Minimize2, ArrowDownUp, TriangleAlert,
} from 'lucide-vue-next'
import { useQuery } from '~/composables/api'
import type { DbTable, DbColumn, RawSqlResult } from '~/composables/api'

definePageMeta({ layout: 'default' })

type FieldType = 'string' | 'number' | 'datetime' | 'uuid' | 'boolean'
type Command = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'ALTER' | 'TRUNCATE' | 'DROP'
type AlterAction =
  | 'ADD_COLUMN' | 'DROP_COLUMN' | 'RENAME_COLUMN' | 'RENAME_TABLE'
  | 'SET_NOT_NULL' | 'DROP_NOT_NULL' | 'SET_DEFAULT' | 'DROP_DEFAULT'
interface SynthField { name: string; pg: string; type: FieldType; is_pk: boolean }
interface FilterRow { id: number; field: string; op: string; value: string; value2: [string, string] }
interface SortRow { id: number; field: string; direction: 'asc' | 'desc' }
interface KvRow { id: number; column: string; value: string }
interface CreateColRow { id: number; name: string; type: string; nullable: boolean; pk: boolean; default: string }
interface DbTreeGroup { id: string; schema: string; tables: DbTable[] }

const PG_TYPES = [
  'text', 'varchar(255)', 'integer', 'bigint', 'smallint', 'boolean', 'uuid',
  'numeric', 'numeric(12,2)', 'real', 'double precision', 'timestamptz', 'timestamp',
  'date', 'time', 'jsonb', 'json', 'bytea', 'serial', 'bigserial', 'inet',
]

const OPS: { value: string; label: string }[] = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '≥' },
  { value: 'lte', label: '≤' },
  { value: 'between', label: 'BETWEEN' },
  { value: 'contains', label: 'ILIKE' },
  { value: 'in', label: 'IN' },
]

const PILL_COLS = new Set(['severity', 'status', 'ranking_tier', 'congestion_level', 'vehicle_type', 'state', 'priority'])
const PILL_VARIANTS: Record<string, string> = {
  fatal: 'danger', critical: 'danger', high: 'danger', severe: 'danger', impounded: 'danger', error: 'danger', failed: 'danger',
  serious: 'warning', medium: 'warning', moderate: 'warning', heavy: 'warning', pending: 'warning',
  open: 'warning', reported: 'warning', active: 'warning', maintenance: 'warning', scheduled: 'warning',
  investigating: 'info', triaged: 'info', dispatched: 'info', on_scene: 'info', processing: 'info',
  resolved: 'success', cleared: 'success', operational: 'success', low: 'success', free_flow: 'success', done: 'success', ok: 'success',
  minor: 'neutral', closed: 'neutral', cancelled: 'neutral', inactive: 'neutral',
}

let _id = 0
const nextId = () => ++_id

function pgToFieldType(d: string): FieldType {
  const s = (d || '').toLowerCase()
  if (s === 'uuid') return 'uuid'
  if (/bool/.test(s)) return 'boolean'
  if (/int|numeric|real|double|decimal|money|serial|float/.test(s)) return 'number'
  if (/^timestamp|^date$|^time|interval/.test(s)) return 'datetime'
  return 'string'
}
function fieldIcon(f: SynthField) {
  if (f.is_pk || f.type === 'uuid') return KeyRound
  if (f.type === 'number') return Hash
  if (f.type === 'datetime') return CalendarClock
  if (f.type === 'boolean') return List
  return Type
}
function dbColIcon(c: DbColumn) {
  const d = c.data_type
  if (d === 'uuid') return KeyRound
  if (d === 'jsonb' || d === 'json') return Braces
  if (/int|numeric|real|double|decimal|money|serial/.test(d)) return Hash
  if (/timestamp|date|time|interval/.test(d)) return CalendarClock
  if (/bool/.test(d)) return List
  return Type
}
/** Double-quote a Postgres identifier, escaping embedded quotes. */
function qname(ident: string) { return `"${String(ident).replace(/"/g, '""')}"` }

// ── Schema (gisdb) ───────────────────────────────────────────────────
const PG_ID = 'pg:root'
const dbSchema = ref<DbTable[]>([])
const dbName = ref('')
const loadingSchema = ref(true)
const consoleAvailable = ref(false)
const consoleMessage = ref<string | null>(null)
const schemaSearch = ref('')
const expandedNodes = ref<Set<string>>(new Set([PG_ID]))
function tableId(t: DbTable) { return `pgt:${t.schema}.${t.name}` }

async function loadSchema() {
  loadingSchema.value = true
  try {
    const res = await useQuery().schema()
    if (res.enabled) {
      dbSchema.value = res.tables ?? []
      dbName.value = res.database ?? 'database'
      consoleAvailable.value = true
      consoleMessage.value = null
      const next = new Set(expandedNodes.value)
      next.add(PG_ID)
      for (const s of new Set(dbSchema.value.map(t => t.schema))) next.add(`pg:${s}`)
      expandedNodes.value = next
      // Re-point the active table at the refreshed schema (it may have been
      // altered, renamed, or dropped by a committed DDL statement).
      if (currentTable.value) {
        const key = `${currentTable.value.schema}.${currentTable.value.name}`
        currentTable.value = dbSchema.value.find(t => `${t.schema}.${t.name}` === key) ?? null
      }
    } else {
      consoleAvailable.value = false
      consoleMessage.value = res.detail ?? 'The database console is disabled on this server.'
    }
  } catch (e: any) {
    consoleAvailable.value = false
    const code = e?.status ?? e?.statusCode ?? e?.response?.status
    consoleMessage.value = code === 403
      ? 'The query console requires an admin account.'
      : (e?.data?.detail ?? e?.message ?? 'Unable to load the database schema.')
  } finally {
    loadingSchema.value = false
  }
}

const dbTree = computed<DbTreeGroup[]>(() => {
  const q = schemaSearch.value.trim().toLowerCase()
  const order: string[] = []
  const bucket = new Map<string, DbTable[]>()
  for (const t of dbSchema.value) {
    const nameHit = !q
      || t.name.toLowerCase().includes(q)
      || `${t.schema}.${t.name}`.toLowerCase().includes(q)
    const colHit = q && !nameHit ? t.columns.some(c => c.name.toLowerCase().includes(q)) : true
    if (q && !nameHit && !colHit) continue
    if (!bucket.has(t.schema)) { bucket.set(t.schema, []); order.push(t.schema) }
    bucket.get(t.schema)!.push(t)
  }
  return order.map(s => ({ id: `pg:${s}`, schema: s, tables: bucket.get(s)! }))
})

function nodeOpen(id: string) {
  if (schemaSearch.value.trim()) return true
  return expandedNodes.value.has(id)
}
function toggleNode(id: string) {
  const next = new Set(expandedNodes.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expandedNodes.value = next
}

// ── Builder state ────────────────────────────────────────────────────
const builderMode = ref<'visual' | 'sql'>('visual')
const currentTable = ref<DbTable | null>(null)
const activeTableKey = computed(() =>
  currentTable.value ? `${currentTable.value.schema}.${currentTable.value.name}` : '',
)
const tableFields = computed<SynthField[]>(() =>
  (currentTable.value?.columns ?? []).map(c => ({
    name: c.name,
    pg: c.data_type,
    type: pgToFieldType(c.data_type),
    is_pk: c.is_pk,
  })),
)

// Which SQL command the visual builder emits.
const command = ref<Command>('SELECT')
const visualDryRun = ref(true)   // for non-SELECT: run inside a rolled-back txn

const selectAll = ref(true)
const selectedFields = ref<string[]>([])
const selectMenuOpen = ref(false)
const selectCardRef = ref<HTMLElement | null>(null)
const filterConjunction = ref<'AND' | 'OR'>('AND')
const filters = ref<FilterRow[]>([])
const sorts = ref<SortRow[]>([])
const limitEnabled = ref(true)
const limitValue = ref(1000)

// INSERT / UPDATE
const insertRows = ref<KvRow[]>([])
const setRows = ref<KvRow[]>([])
// TRUNCATE / DROP
const truncRestartId = ref(false)
const truncCascade = ref(false)
const dropIfExists = ref(true)
const dropCascade = ref(false)
// CREATE TABLE
const newTableName = ref('')
const createIfNotExists = ref(true)
const createCols = ref<CreateColRow[]>([])
// ALTER TABLE
const alterAction = ref<AlterAction>('ADD_COLUMN')
const alterColName = ref('')
const alterColType = ref('text')
const alterColNullable = ref(true)
const alterColDefault = ref('')
const alterTargetCol = ref('')
const alterNewName = ref('')
const alterCascade = ref(false)

function addKv(which: 'insert' | 'set') {
  const list = which === 'insert' ? insertRows : setRows
  list.value.push({ id: nextId(), column: '', value: '' })
}
function removeKv(which: 'insert' | 'set', id: number) {
  const list = which === 'insert' ? insertRows : setRows
  list.value = list.value.filter(r => r.id !== id)
}
function addCreateCol() {
  createCols.value.push({ id: nextId(), name: '', type: 'text', nullable: true, pk: false, default: '' })
}
function removeCreateCol(id: number) { createCols.value = createCols.value.filter(c => c.id !== id) }

function resetCommandInputs() {
  insertRows.value = []
  setRows.value = []
  truncRestartId.value = false
  truncCascade.value = false
  dropIfExists.value = true
  dropCascade.value = false
  alterAction.value = 'ADD_COLUMN'
  alterColName.value = ''
  alterColType.value = 'text'
  alterColNullable.value = true
  alterColDefault.value = ''
  alterTargetCol.value = ''
  alterNewName.value = ''
  alterCascade.value = false
}

const needsTable = computed(() => command.value !== 'CREATE')
const showWhere = computed(() => command.value === 'SELECT' || command.value === 'UPDATE' || command.value === 'DELETE')
const whereConds = computed(() => filters.value.map(filterSql).filter(Boolean) as string[])
const hasWhere = computed(() => whereConds.value.length > 0)
const dangerNote = computed(() => {
  const c = command.value
  if (c === 'DELETE' && !hasWhere.value) return 'No WHERE — this deletes every row in the table.'
  if (c === 'UPDATE' && !hasWhere.value) return 'No WHERE — this updates every row in the table.'
  if (c === 'DROP') return 'DROP permanently removes the table and all of its data.'
  if (c === 'TRUNCATE') return `TRUNCATE empties the table${truncCascade.value ? ' and cascades to referencing tables' : ''}.`
  return ''
})

const addableFields = computed(() => {
  const chosen = new Set(selectedFields.value)
  return tableFields.value.filter(f => !chosen.has(f.name))
})
function isFieldChosen(name: string) { return selectAll.value || selectedFields.value.includes(name) }
function inputTypeFor(field: string) {
  const f = tableFields.value.find(x => x.name === field)
  if (f?.type === 'number') return 'number'
  if (f?.type === 'datetime') return 'datetime-local'
  return 'text'
}

function selectTable(t: DbTable) {
  builderMode.value = 'visual'
  currentTable.value = t
  selectAll.value = true
  selectedFields.value = []
  selectMenuOpen.value = false
  filters.value = []
  sorts.value = []
  resetCommandInputs()
  page.value = 1
  rawResult.value = null
  rawError.value = null
  rawSqlState.value = null
  expandedNodes.value = new Set(expandedNodes.value).add(tableId(t))
}
function resetBuilder() {
  currentTable.value = null
  command.value = 'SELECT'
  selectAll.value = true
  selectedFields.value = []
  selectMenuOpen.value = false
  filters.value = []
  sorts.value = []
  resetCommandInputs()
  newTableName.value = ''
  createCols.value = []
  page.value = 1
  rawResult.value = null
  rawError.value = null
  rawSqlState.value = null
  if (builderMode.value === 'sql') sqlDraft.value = ''
}

function onColumnClick(t: DbTable, c: DbColumn) {
  if (builderMode.value === 'sql') { insertAtCursor(qname(c.name)); return }
  if (activeTableKey.value !== `${t.schema}.${t.name}`) selectTable(t)
  if (command.value !== 'SELECT') return
  if (selectAll.value) {
    selectAll.value = false
    selectedFields.value = [c.name]
    return
  }
  selectedFields.value = selectedFields.value.includes(c.name)
    ? selectedFields.value.filter(f => f !== c.name)
    : [...selectedFields.value, c.name]
  if (!selectedFields.value.length) selectAll.value = true
}
function onSelectPlus() {
  if (selectAll.value) customizeColumns()
  else selectMenuOpen.value = !selectMenuOpen.value
}
function customizeColumns() {
  selectAll.value = false
  selectedFields.value = tableFields.value.map(f => f.name)
  selectMenuOpen.value = true
}
function useAllColumns() {
  selectAll.value = true
  selectedFields.value = []
  selectMenuOpen.value = false
}
function addField(name: string) {
  selectAll.value = false
  if (!selectedFields.value.includes(name)) selectedFields.value = [...selectedFields.value, name]
  if (!addableFields.value.length) selectMenuOpen.value = false
}
function removeField(name: string) {
  selectedFields.value = selectedFields.value.filter(f => f !== name)
  if (!selectedFields.value.length) { selectAll.value = true; selectMenuOpen.value = false }
}
onClickOutside(selectCardRef, () => { selectMenuOpen.value = false })

function addFilter() { filters.value.push({ id: nextId(), field: '', op: 'eq', value: '', value2: ['', ''] }) }
function removeFilter(id: number) { filters.value = filters.value.filter(f => f.id !== id) }
function addSort() { sorts.value.push({ id: nextId(), field: '', direction: 'asc' }) }
function removeSort(id: number) { sorts.value = sorts.value.filter(s => s.id !== id) }

// ── SQL editor ───────────────────────────────────────────────────────
const sqlDraft = ref('')
const sqlReadOnly = ref(true)
const sqlMaxRows = ref(1000)
const sqlEditorRef = ref<HTMLTextAreaElement | null>(null)
const gutterTop = ref(0)
const sqlLineCount = computed(() => Math.max(1, sqlDraft.value.split('\n').length))

function editAsSql() {
  sqlDraft.value = generatedSql.value
  builderMode.value = 'sql'
  nextTick(() => sqlEditorRef.value?.focus())
}
function insertAtCursor(text: string) {
  const el = sqlEditorRef.value
  if (!el) { sqlDraft.value += text; return }
  const s = el.selectionStart ?? sqlDraft.value.length
  const e = el.selectionEnd ?? sqlDraft.value.length
  sqlDraft.value = sqlDraft.value.slice(0, s) + text + sqlDraft.value.slice(e)
  nextTick(() => { el.focus(); const p = s + text.length; el.setSelectionRange(p, p) })
}
function onSqlKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') { e.preventDefault(); insertAtCursor('  ') }
  else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runQuery() }
}

// ── Generated SQL (visual mode) ──────────────────────────────────────
function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function sqlLit(v: string) {
  const s = v.trim()
  return s !== '' && !Number.isNaN(Number(s)) ? s : `'${s.replace(/'/g, "''")}'`
}
/** INSERT/UPDATE value: blank => NULL, numeric => bare, else quoted literal. */
function qval(v: string) {
  const s = (v ?? '').trim()
  if (s === '') return 'NULL'
  return !Number.isNaN(Number(s)) ? s : `'${s.replace(/'/g, "''")}'`
}
function colType(c: CreateColRow) { return (c.type || '').trim() || 'text' }
function filterSql(f: FilterRow): string | null {
  if (!f.field) return null
  const col = qname(f.field)
  switch (f.op) {
    case 'eq': return f.value === '' ? null : `${col} = ${sqlLit(f.value)}`
    case 'neq': return f.value === '' ? null : `${col} <> ${sqlLit(f.value)}`
    case 'gt': return f.value === '' ? null : `${col} > ${sqlLit(f.value)}`
    case 'lt': return f.value === '' ? null : `${col} < ${sqlLit(f.value)}`
    case 'gte': return f.value === '' ? null : `${col} >= ${sqlLit(f.value)}`
    case 'lte': return f.value === '' ? null : `${col} <= ${sqlLit(f.value)}`
    case 'contains': return f.value === '' ? null : `${col} ILIKE '%${f.value.replace(/'/g, "''")}%'`
    case 'in': {
      const parts = f.value.split(',').map(s => s.trim()).filter(Boolean)
      return parts.length ? `${col} IN (${parts.map(sqlLit).join(', ')})` : null
    }
    case 'between': {
      const [a, b] = f.value2
      return a && b ? `${col} BETWEEN ${sqlLit(a)} AND ${sqlLit(b)}` : null
    }
    default: return null
  }
}
const generatedSql = computed(() => {
  const c = command.value
  const t = currentTable.value
  const rel = t ? `${qname(t.schema)}.${qname(t.name)}` : ''
  const whereClause = () => (whereConds.value.length
    ? `\nWHERE ${whereConds.value.join(`\n  ${filterConjunction.value} `)}`
    : '')

  if (c === 'CREATE') {
    const name = newTableName.value.trim()
    if (!name) return '-- Enter a name for the new table'
    const cols = createCols.value.filter(cc => cc.name.trim())
    if (!cols.length) return '-- Add at least one column'
    const lines = cols.map(cc => {
      let ln = `  ${qname(cc.name.trim())} ${colType(cc)}`
      if (!cc.nullable) ln += ' NOT NULL'
      if (cc.default.trim()) ln += ` DEFAULT ${cc.default.trim()}`
      return ln
    })
    const pks = cols.filter(cc => cc.pk).map(cc => qname(cc.name.trim()))
    if (pks.length) lines.push(`  PRIMARY KEY (${pks.join(', ')})`)
    const head = createIfNotExists.value ? 'CREATE TABLE IF NOT EXISTS' : 'CREATE TABLE'
    return `${head} ${qname('public')}.${qname(name)} (\n${lines.join(',\n')}\n);`
  }

  if (!t) return '-- Pick a table to preview the generated SQL'

  if (c === 'SELECT') {
    const cols = !selectAll.value && selectedFields.value.length && selectedFields.value.length < tableFields.value.length
      ? selectedFields.value.map(qname).join(', ')
      : '*'
    let sql = `SELECT ${cols}\nFROM ${rel}${whereClause()}`
    const os = sorts.value.filter(s => s.field)
    if (os.length) sql += `\nORDER BY ${os.map(s => `${qname(s.field)} ${s.direction.toUpperCase()}`).join(', ')}`
    if (limitEnabled.value) sql += `\nLIMIT ${limitValue.value}`
    return `${sql};`
  }

  if (c === 'INSERT') {
    const rows = insertRows.value.filter(r => r.column)
    if (!rows.length) return `-- Add at least one column to insert into ${t.name}`
    return `INSERT INTO ${rel} (${rows.map(r => qname(r.column)).join(', ')})\nVALUES (${rows.map(r => qval(r.value)).join(', ')});`
  }

  if (c === 'UPDATE') {
    const sets = setRows.value.filter(r => r.column)
    if (!sets.length) return '-- Add at least one SET assignment'
    return `UPDATE ${rel}\nSET ${sets.map(r => `${qname(r.column)} = ${qval(r.value)}`).join(', ')}${whereClause()};`
  }

  if (c === 'DELETE') return `DELETE FROM ${rel}${whereClause()};`

  if (c === 'TRUNCATE') {
    let sql = `TRUNCATE TABLE ${rel}`
    if (truncRestartId.value) sql += ' RESTART IDENTITY'
    if (truncCascade.value) sql += ' CASCADE'
    return `${sql};`
  }

  if (c === 'DROP') {
    return `DROP TABLE ${dropIfExists.value ? 'IF EXISTS ' : ''}${rel}${dropCascade.value ? ' CASCADE' : ''};`
  }

  if (c === 'ALTER') {
    const base = `ALTER TABLE ${rel}`
    switch (alterAction.value) {
      case 'ADD_COLUMN': {
        const n = alterColName.value.trim()
        if (!n) return '-- Enter the new column name'
        let s = `${base} ADD COLUMN ${qname(n)} ${(alterColType.value || 'text').trim()}`
        if (!alterColNullable.value) s += ' NOT NULL'
        if (alterColDefault.value.trim()) s += ` DEFAULT ${alterColDefault.value.trim()}`
        return `${s};`
      }
      case 'DROP_COLUMN':
        if (!alterTargetCol.value) return '-- Choose a column to drop'
        return `${base} DROP COLUMN ${qname(alterTargetCol.value)}${alterCascade.value ? ' CASCADE' : ''};`
      case 'RENAME_COLUMN':
        if (!alterTargetCol.value || !alterNewName.value.trim()) return '-- Choose a column and enter a new name'
        return `${base} RENAME COLUMN ${qname(alterTargetCol.value)} TO ${qname(alterNewName.value.trim())};`
      case 'RENAME_TABLE':
        if (!alterNewName.value.trim()) return '-- Enter the new table name'
        return `${base} RENAME TO ${qname(alterNewName.value.trim())};`
      case 'SET_NOT_NULL':
      case 'DROP_NOT_NULL':
        if (!alterTargetCol.value) return '-- Choose a column'
        return `${base} ALTER COLUMN ${qname(alterTargetCol.value)} ${alterAction.value === 'SET_NOT_NULL' ? 'SET' : 'DROP'} NOT NULL;`
      case 'SET_DEFAULT':
        if (!alterTargetCol.value || !alterColDefault.value.trim()) return '-- Choose a column and enter a default expression'
        return `${base} ALTER COLUMN ${qname(alterTargetCol.value)} SET DEFAULT ${alterColDefault.value.trim()};`
      case 'DROP_DEFAULT':
        if (!alterTargetCol.value) return '-- Choose a column'
        return `${base} ALTER COLUMN ${qname(alterTargetCol.value)} DROP DEFAULT;`
    }
  }

  return '-- Unsupported command'
})
/** The generated SQL is runnable when it isn't one of the `-- hint` placeholders. */
const visualValid = computed(() => !generatedSql.value.startsWith('--'))

function highlightSql(line: string) {
  return esc(line).replace(
    /\b(SELECT|INSERT INTO|INSERT|UPDATE|DELETE FROM|DELETE|VALUES|SET|CREATE TABLE|CREATE|ALTER TABLE|ALTER|ADD COLUMN|DROP COLUMN|DROP TABLE|DROP|TRUNCATE TABLE|TRUNCATE|RENAME COLUMN|RENAME TO|RENAME|PRIMARY KEY|DEFAULT|CASCADE|RESTART IDENTITY|IF EXISTS|IF NOT EXISTS|FROM|WHERE|AND|OR|ORDER BY|GROUP BY|LIMIT|OFFSET|BETWEEN|IN|LIKE|ILIKE|IS|NULL|NOT NULL|NOT|ASC|DESC|JOIN|ON|AS)\b/g,
    '<span class="kw">$1</span>',
  )
}
const sqlLines = computed(() => generatedSql.value.split('\n').map(highlightSql))

const sqlCopied = ref(false)
let sqlTimer: ReturnType<typeof setTimeout> | undefined
async function copySql() {
  try {
    await navigator.clipboard.writeText(generatedSql.value)
    sqlCopied.value = true
    flash('copied')
    clearTimeout(sqlTimer)
    sqlTimer = setTimeout(() => { sqlCopied.value = false }, 1600)
  } catch { /* clipboard unavailable */ }
}

// ── Execution ────────────────────────────────────────────────────────
const rawResult = ref<RawSqlResult | null>(null)
const rawError = ref<string | null>(null)
const rawSqlState = ref<string | null>(null)
const rawExecuting = ref(false)
const rawSortCol = ref('')
const rawSortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(25)
const resultsMaximized = ref(false)

const busy = computed(() => rawExecuting.value)
const canRun = computed(() =>
  builderMode.value === 'sql' ? !!sqlDraft.value.trim() : visualValid.value,
)
const hasResult = computed(() => !!rawResult.value)
const isAffected = computed(() => rawResult.value?.row_type === 'affected')
const affectedIsDml = computed(() =>
  (rawResult.value?.statements ?? []).some(s => ['INSERT', 'UPDATE', 'DELETE'].includes(s.command)),
)
const DDL_COMMANDS = new Set(['CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME', 'COMMENT', 'GRANT', 'REVOKE'])

const rawRowsSorted = computed<Record<string, unknown>[]>(() => {
  const rows = rawResult.value?.rows ?? []
  if (!rawSortCol.value) return rows
  const c = rawSortCol.value
  const dir = rawSortDir.value === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = a[c], bv = b[c]
    if (av == null && bv == null) return 0
    if (av == null) return -dir
    if (bv == null) return dir
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })
})
const displayColumns = computed<string[]>(() => rawResult.value?.columns ?? [])
const displayTotal = computed(() => rawResult.value?.rowcount ?? 0)
const displayRows = computed<Record<string, unknown>[]>(() => {
  const start = (page.value - 1) * pageSize.value
  return rawRowsSorted.value.slice(start, start + pageSize.value)
})
const displayElapsed = computed(() => {
  const ms = rawResult.value?.duration_ms
  return ms == null ? '—' : `${(ms / 1000).toFixed(2)}s`
})
const totalPages = computed(() => Math.max(1, Math.ceil(displayTotal.value / pageSize.value)))
const pageNumbers = computed<(number | '…')[]>(() => {
  const tp = totalPages.value
  const cur = page.value
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  let start = Math.max(2, cur - 2)
  const end = Math.min(tp - 1, start + 3)
  start = Math.max(2, end - 3)
  if (start > 2) out.push('…')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < tp - 1) out.push('…')
  out.push(tp)
  return out
})

function runQuery() {
  if (builderMode.value === 'sql') runRaw()
  else runVisual()
}
function goToPage(n: number) {
  page.value = Math.min(Math.max(1, n), totalPages.value)
}
watch(pageSize, () => { page.value = 1 })
watch([command, builderMode], () => {
  rawResult.value = null
  rawError.value = null
  rawSqlState.value = null
  page.value = 1
})

async function runVisual() {
  if (!visualValid.value || rawExecuting.value) return
  const readOnly = command.value === 'SELECT' ? true : visualDryRun.value
  rawExecuting.value = true
  rawError.value = null
  rawSqlState.value = null
  try {
    rawResult.value = await useQuery().raw({
      sql: generatedSql.value,
      read_only: readOnly,
      max_rows: Math.max(1, Math.min(limitEnabled.value ? Number(limitValue.value) || 1000 : 1000, 10000)),
    })
    page.value = 1
    rawSortCol.value = ''
    // A committed schema change makes the browser stale — refresh it.
    if (!readOnly && DDL_COMMANDS.has(command.value)) loadSchema()
  } catch (e: any) {
    rawResult.value = null
    rawError.value = e?.data?.detail ?? e?.message ?? 'Query execution failed.'
    rawSqlState.value = e?.data?.sqlstate ?? null
  } finally {
    rawExecuting.value = false
  }
}
async function runRaw() {
  const sql = sqlDraft.value.trim()
  if (!sql || rawExecuting.value) return
  rawExecuting.value = true
  rawError.value = null
  rawSqlState.value = null
  try {
    rawResult.value = await useQuery().raw({
      sql,
      read_only: sqlReadOnly.value,
      max_rows: Math.max(1, Math.min(Number(sqlMaxRows.value) || 1000, 10000)),
    })
    page.value = 1
    rawSortCol.value = ''
    if (!sqlReadOnly.value && (rawResult.value?.statements ?? []).some(s => DDL_COMMANDS.has(s.command))) {
      loadSchema()
    }
  } catch (e: any) {
    rawResult.value = null
    rawError.value = e?.data?.detail ?? e?.message ?? 'SQL execution failed.'
    rawSqlState.value = e?.data?.sqlstate ?? null
  } finally {
    rawExecuting.value = false
  }
}

function sortDirFor(col: string): 'asc' | 'desc' | '' {
  return rawSortCol.value === col ? rawSortDir.value : ''
}
function sortByColumn(col: string) {
  if (rawSortCol.value === col) rawSortDir.value = rawSortDir.value === 'asc' ? 'desc' : 'asc'
  else { rawSortCol.value = col; rawSortDir.value = 'asc' }
  page.value = 1
}

// ── Result cell rendering ────────────────────────────────────────────
function isPillCol(col: string) { return PILL_COLS.has(col) }
function pillVariant(v: unknown) { return PILL_VARIANTS[String(v).toLowerCase()] ?? 'neutral' }
function isUuidCol(col: string) {
  const f = tableFields.value.find(x => x.name === col)
  if (f) return f.type === 'uuid'
  return col === 'id' || col.endsWith('_id')
}
function isDateCol(col: string) {
  const f = tableFields.value.find(x => x.name === col)
  if (f) return f.type === 'datetime'
  return /_at$|_date$|^date$|timestamp/.test(col)
}
function fmtDate(v: unknown) {
  try {
    const d = new Date(v as string)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toISOString().slice(0, 19).replace('T', ' ')
  } catch { return String(v) }
}
function fmtNum(v: number | null | undefined) { return v == null ? '—' : v.toLocaleString() }
function formatCell(v: unknown) {
  if (v == null) return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  return s.length > 120 ? `${s.slice(0, 120)}…` : s
}

// ── Export ───────────────────────────────────────────────────────────
const exportMenuOpen = ref(false)
const exportRef = ref<HTMLElement | null>(null)
const flashMsg = ref<string | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  flashMsg.value = msg
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { flashMsg.value = null }, 2200)
}
onClickOutside(exportRef, () => { exportMenuOpen.value = false })

const canExport = computed(() =>
  !!rawResult.value && rawResult.value.row_type === 'result' && !!rawResult.value.rows.length,
)
function triggerDownload(blob: Blob, name: string) {
  if (typeof window === 'undefined') return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
function exportBaseName() {
  return builderMode.value === 'sql' ? 'sql' : (currentTable.value?.name ?? 'query')
}
function exportJSON() {
  if (!rawResult.value) return
  triggerDownload(
    new Blob([JSON.stringify(rawRowsSorted.value, null, 2)], { type: 'application/json' }),
    `uapts-query-${exportBaseName()}.json`,
  )
  flash('exported')
}
function exportCSV() {
  if (!rawResult.value) return
  const cols = rawResult.value.columns
  const lines = [
    cols.join(','),
    ...rawRowsSorted.value.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(',')),
  ]
  triggerDownload(new Blob([lines.join('\n')], { type: 'text/csv' }), `uapts-query-${exportBaseName()}.csv`)
  flash('exported')
}

onMounted(loadSchema)
</script>

<style scoped>
/* ══════════════ Layout ══════════════ */
.qb-grid {
  display: grid;
  grid-template-columns: 264px minmax(360px, 430px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  margin-top: 6px;
}
.qb-grid.is-max { grid-template-columns: minmax(0, 1fr); }
.qb-grid.is-max .col-schema,
.qb-grid.is-max .col-builder { display: none; }
@media (max-width: 1240px) {
  .qb-grid { grid-template-columns: 240px minmax(0, 1fr); }
  .col-result { grid-column: 1 / -1; }
}
@media (max-width: 900px) {
  .qb-grid, .qb-grid.is-max { grid-template-columns: 1fr; }
  .col-schema, .col-builder, .col-result { grid-column: auto; }
}

.qb-col {
  background: var(--surface-2, #fff);
  border: 1px solid var(--border-subtle, #d5dee9);
  border-radius: var(--r-md, 12px);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 168px);
  overflow: hidden;
  box-shadow: var(--elev-1);
}
.qb-col-head {
  flex-shrink: 0;
  padding: 9px 14px;
  border-bottom: 1px solid var(--border-subtle, #d5dee9);
  background: var(--surface-1, #f8fafc);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
}
.qb-col-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--fg-3, #586778);
}
.qb-col-scroll { flex: 1; overflow-y: auto; padding: 12px; }
.qb-col-foot {
  flex-shrink: 0;
  border-top: 1px solid var(--border-subtle, #d5dee9);
  padding: 8px 10px;
  background: var(--surface-1, #f8fafc);
}

/* ══════════════ Shared bits ══════════════ */
.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: var(--r-sm, 8px);
  border: 1px solid transparent; background: transparent;
  color: var(--fg-3, #586778); cursor: pointer;
  transition: background-color .12s, color .12s, border-color .12s;
}
.icon-btn:hover { background: var(--surface-sunken, #dce3ec); color: var(--fg-1, #16202b); }
.icon-btn:disabled { opacity: .4; cursor: not-allowed; }
.spin { animation: qb-spin .8s linear infinite; }
@keyframes qb-spin { to { transform: rotate(360deg); } }

.ctl {
  width: 100%;
  padding: 6px 9px;
  border: 1px solid var(--border-interactive, #7b8ea8);
  border-radius: var(--r-sm, 8px);
  background: var(--surface-2, #fff);
  font-size: 12px;
  color: var(--fg-1, #16202b);
  font-family: inherit;
  outline: none;
}
.ctl:focus { border-color: var(--primary, #0d4c8b); box-shadow: 0 0 0 3px var(--primary-wash-strong, rgba(13, 76, 139, .12)); }
.ctl:disabled { background: var(--surface-1, #f1f5f9); color: var(--fg-3, #94a3b8); }

.qb-error {
  display: flex; align-items: flex-start; gap: 7px;
  font-size: 11.5px; color: var(--danger-fg, #b42318);
  background: var(--danger-bg, rgba(180, 35, 24, .1));
  border: 1px solid rgba(180, 35, 24, .22);
  border-radius: var(--r-sm, 8px); padding: 8px 10px; margin: 10px 0 2px;
}
.qb-error .sqlstate {
  display: block; margin-top: 3px; font-size: 10px; font-weight: 700;
  letter-spacing: .04em; opacity: .8;
}

.mode-toggle { display: inline-flex; border: 1px solid var(--border-interactive, #7b8ea8); border-radius: 6px; overflow: hidden; }
.mode-toggle button {
  border: none; background: var(--surface-2, #fff); cursor: pointer;
  font-size: 10.5px; font-weight: 700; letter-spacing: .04em; padding: 4px 12px; color: var(--fg-3, #586778);
}
.mode-toggle button.on { background: var(--primary, #0d4c8b); color: #fff; }

/* ══════════════ Schema browser ══════════════ */
.tree-search {
  display: flex; align-items: center; gap: 7px;
  padding: 6px 9px; margin-bottom: 8px;
  border: 1px solid var(--border-interactive, #7b8ea8);
  border-radius: var(--r-sm, 8px); background: var(--surface-2, #fff); color: var(--fg-3, #586778);
}
.tree-search:focus-within { border-color: var(--primary, #0d4c8b); box-shadow: 0 0 0 3px var(--primary-wash-strong, rgba(13, 76, 139, .12)); }
.tree-search input { border: none; outline: none; background: transparent; flex: 1; min-width: 0; font-size: 12px; color: var(--fg-1, #16202b); }
.tree-search-x { border: none; background: transparent; color: var(--fg-3, #586778); cursor: pointer; display: inline-flex; padding: 0; }
.tree-hint { font-size: 11.5px; color: var(--fg-3, #94a3b8); padding: 8px 2px; }
.tree-hint.sub { padding: 4px 2px 6px 20px; }
.tree-note {
  display: flex; align-items: flex-start; gap: 6px;
  font-size: 11px; color: var(--fg-3, #586778);
  background: var(--surface-1, #f8fafc); border: 1px dashed var(--border-subtle, #d5dee9);
  border-radius: var(--r-sm, 8px); padding: 8px 10px; margin-top: 8px;
}

.tree-row {
  width: 100%; display: flex; align-items: center; gap: 5px;
  padding: 4px 6px; border: none; background: transparent; cursor: pointer;
  font-size: 12px; color: var(--fg-2, #4a5a6e); border-radius: 5px;
  text-align: left;
}
.tree-row.lvl-0 { margin-top: 2px; font-weight: 600; color: var(--fg-1, #16202b); }
.tree-row:hover { background: var(--surface-1, #f8fafc); }
.tree-row.lvl-1 { padding-left: 16px; }
.tree-row.lvl-2 { padding-left: 24px; gap: 3px; }
.tree-row.lvl-2.active { background: var(--info-bg, rgba(13, 76, 139, .08)); }
.tree-caret { color: var(--fg-3, #94a3b8); flex-shrink: 0; }
.tree-caret-btn {
  border: none; background: transparent; cursor: pointer; color: var(--fg-3, #94a3b8);
  display: inline-flex; padding: 2px; border-radius: 4px; flex-shrink: 0;
}
.tree-caret-btn:hover { background: var(--surface-sunken, #dce3ec); color: var(--fg-1, #16202b); }
.tree-row-main {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px;
  border: none; background: transparent; cursor: pointer; padding: 3px 4px;
  border-radius: 4px; text-align: left; color: inherit;
}
.tree-row-main:hover { background: var(--surface-1, #f8fafc); }
.tree-row.lvl-2.active .tree-row-main { color: var(--primary, #0d4c8b); font-weight: 600; }
.tree-ic { flex-shrink: 0; }
.ic-db { color: var(--primary, #0d4c8b); }
.ic-schema { color: var(--warning-fg, #8a5a00); }
.ic-table { color: var(--fg-3, #586778); }
.tree-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-name.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11.5px; }
.tree-kind {
  font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
  color: var(--accent-purple, #6d28d9); background: color-mix(in srgb, var(--accent-purple, #6d28d9) 14%, transparent); padding: 0 4px; border-radius: 3px; flex-shrink: 0;
}
.tree-badge {
  font-size: 9.5px; font-weight: 700; padding: 0 5px; border-radius: var(--r-pill, 999px);
  background: var(--surface-sunken, #dce3ec); color: var(--fg-3, #586778); flex-shrink: 0;
}

.tree-col {
  width: 100%; display: flex; align-items: center; gap: 7px;
  padding: 3px 6px 3px 42px; border: none; background: transparent; cursor: pointer;
  border-left: 2px solid transparent; text-align: left;
}
.tree-col:hover { background: var(--info-bg, rgba(13, 76, 139, .06)); }
.tree-col.picked { background: var(--info-bg, rgba(13, 76, 139, .08)); border-left-color: var(--primary, #0d4c8b); }
.tree-col-ic { flex-shrink: 0; color: var(--fg-3, #94a3b8); }
.tree-col.picked .tree-col-ic { color: var(--primary, #0d4c8b); }
.tree-col-name {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; color: var(--fg-1, #16202b);
}
.tree-col-type { font-size: 9.5px; color: var(--fg-3, #94a3b8); text-transform: lowercase; flex-shrink: 0; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.foot-btn {
  width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 7px; border: 1px dashed var(--border-interactive, #7b8ea8); border-radius: var(--r-sm, 8px);
  background: transparent; cursor: pointer; font-size: 11.5px; font-weight: 600; color: var(--primary, #0d4c8b);
}
.foot-btn:hover { background: var(--info-bg, rgba(13, 76, 139, .06)); border-color: var(--primary, #0d4c8b); }

/* ══════════════ Query builder cards ══════════════ */
.qc {
  border: 1px solid var(--border-subtle, #d5dee9);
  border-radius: var(--r-sm, 8px);
  background: var(--surface-2, #fff);
  margin-bottom: 12px;
}
.qc-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 9px 10px 9px 12px;
  border-bottom: 1px solid var(--border-subtle, #eef2f7);
}
.qc-title {
  font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
  color: var(--fg-1, #16202b); border-left: 3px solid var(--primary, #0d4c8b); padding-left: 8px;
}
.qc-head-right { display: flex; align-items: center; gap: 6px; }
.qc-add {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 6px;
  border: 1px solid var(--border-interactive, #7b8ea8); background: var(--surface-2, #fff);
  color: var(--fg-2, #4a5a6e); cursor: pointer;
}
.qc-add:hover:not(:disabled) { border-color: var(--primary, #0d4c8b); color: var(--primary, #0d4c8b); background: var(--info-bg, rgba(13, 76, 139, .06)); }
.qc-add:disabled { opacity: .4; cursor: not-allowed; }
.qc-body { padding: 10px 12px; }
.qc-empty { font-size: 11.5px; color: var(--fg-3, #94a3b8); line-height: 1.5; }
.qc-empty.sm { padding: 2px 0 8px; }

.chips { position: relative; display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 6px 4px 9px; border-radius: var(--r-sm, 8px);
  background: var(--info-bg, rgba(13, 76, 139, .08)); border: 1px solid var(--primary-wash-strong, rgba(13, 76, 139, .2));
  color: var(--primary, #0d4c8b); font-size: 11px; font-weight: 600;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.chip-x {
  display: inline-flex; border: none; background: transparent; cursor: pointer;
  color: var(--primary, #0d4c8b); padding: 1px; border-radius: 4px;
}
.chip-x:hover { background: var(--primary-wash-strong, rgba(13, 76, 139, .16)); }
.chip-add {
  background: var(--surface-2, #fff); border: 1px dashed var(--border-interactive, #7b8ea8);
  color: var(--fg-2, #4a5a6e); cursor: pointer; font-family: inherit;
}
.chip-add:hover { border-color: var(--primary, #0d4c8b); color: var(--primary, #0d4c8b); }

.menu {
  position: absolute; z-index: 20; top: calc(100% + 6px); left: 0;
  min-width: 200px; max-height: 260px; overflow-y: auto;
  background: var(--surface-2, #fff); border: 1px solid var(--border-strong, #b8c0c9); border-radius: var(--r-sm, 8px);
  box-shadow: var(--elev-3); padding: 5px;
}
.menu.menu-right { left: auto; right: 0; min-width: 170px; }
.menu-item {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border: none; background: transparent; cursor: pointer;
  font-size: 12px; color: var(--fg-1, #16202b); border-radius: 5px; text-align: left;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.menu-item:hover { background: var(--info-bg, rgba(13, 76, 139, .08)); color: var(--primary, #0d4c8b); }
.menu-sep { height: 1px; background: var(--border-subtle, #eef2f7); margin: 4px 0; }
.menu-empty { font-size: 11px; color: var(--fg-3, #94a3b8); padding: 6px 8px; }

.frow-conj {
  font-size: 10px; font-weight: 700; letter-spacing: .06em;
  color: var(--fg-3, #94a3b8); padding: 4px 0 2px 2px;
}
.frow {
  display: grid; grid-template-columns: minmax(0, 1fr) 88px minmax(0, 1.3fr) 26px;
  gap: 5px; align-items: center; margin-bottom: 6px;
}
.frow.sort { grid-template-columns: minmax(0, 1fr) 88px 26px; }
.frow .ctl.op, .frow .ctl.dir { text-align: center; }
.between { display: flex; align-items: center; gap: 4px; }
.between .ctl { padding: 6px 5px; }
.between span { font-size: 11px; color: var(--fg-3, #94a3b8); }
.frow-x {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 6px; border: none;
  background: transparent; color: var(--fg-3, #586778); cursor: pointer;
}
.frow-x:hover { background: var(--danger-bg, rgba(180, 35, 24, .12)); color: var(--danger-fg, #b42318); }

.add-line {
  width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  padding: 6px; margin-top: 2px;
  border: 1px dashed var(--border-interactive, #7b8ea8); border-radius: var(--r-sm, 8px);
  background: transparent; cursor: pointer; font-size: 11.5px; font-weight: 600; color: var(--primary, #0d4c8b);
}
.add-line:hover { background: var(--info-bg, rgba(13, 76, 139, .06)); border-color: var(--primary, #0d4c8b); }

.andor { display: inline-flex; border: 1px solid var(--border-interactive, #7b8ea8); border-radius: 6px; overflow: hidden; }
.andor button {
  border: none; background: var(--surface-2, #fff); cursor: pointer;
  font-size: 10px; font-weight: 700; padding: 3px 8px; color: var(--fg-3, #586778);
}
.andor button.on { background: var(--primary, #0d4c8b); color: #fff; }

.limit-row { display: flex; align-items: center; gap: 8px; }
.limit-row .ctl { max-width: 120px; }
.limit-unit { font-size: 11.5px; color: var(--fg-3, #586778); }

/* ══════════════ Command picker + per-command forms ══════════════ */
.cmd-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.cmd-sel { max-width: 200px; font-weight: 700; }
.dry-chk {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; color: var(--success-fg, #146c33); cursor: pointer;
}
.dry-chk.warn { color: var(--danger-fg, #b42318); }
.dry-chk input { width: 13px; height: 13px; accent-color: var(--primary, #0d4c8b); cursor: pointer; }

.qc-note { font-size: 10.5px; color: var(--fg-3, #94a3b8); margin-top: 6px; }
.qc-note code {
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px;
  background: var(--surface-sunken, #eef2f7); padding: 0 4px; border-radius: 3px;
}

.chk { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--fg-1, #16202b); cursor: pointer; white-space: nowrap; }
.chk.sm { font-size: 11px; color: var(--fg-2, #4a5a6e); }
.chk input { width: 13px; height: 13px; accent-color: var(--primary, #0d4c8b); cursor: pointer; }
.opts { display: flex; gap: 16px; flex-wrap: wrap; }

.kv-row {
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) 26px;
  gap: 5px; align-items: center; margin-bottom: 6px;
}
.kv-row.two { grid-template-columns: minmax(0, 1fr) auto; }

.col-def {
  display: flex; flex-direction: column; gap: 5px;
  padding: 8px; margin-bottom: 6px;
  border: 1px solid var(--border-subtle, #eef2f7); border-radius: 6px;
  background: var(--surface-1, #f8fafc);
}
.col-def .cd-opts { display: flex; align-items: center; gap: 12px; }
.col-def .cd-opts .frow-x { margin-left: auto; }

.alter-fields { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }

.warn-line {
  display: flex; align-items: center; gap: 7px;
  font-size: 11px; color: var(--warning-fg, #8a5a00);
  background: var(--warning-bg, rgba(138, 90, 0, .12));
  border: 1px solid rgba(138, 90, 0, .25); border-radius: var(--r-sm, 8px);
  padding: 8px 10px; margin: 6px 0;
}
.warn-line.danger {
  color: var(--danger-fg, #b42318);
  background: var(--danger-bg, rgba(180, 35, 24, .1));
  border-color: rgba(180, 35, 24, .25);
}

/* ══════════════ SQL preview (visual mode) ══════════════ */
.sqlc {
  border: 1px solid var(--border-subtle, #d5dee9);
  border-radius: var(--r-sm, 8px);
  overflow: hidden;
  margin-top: 4px;
}
.sqlc-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 10px; background: var(--surface-1, #f8fafc);
  border-bottom: 1px solid var(--border-subtle, #eef2f7);
}
.sqlc-title {
  font-size: 10px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
  color: var(--fg-2, #4a5a6e);
}
.sqlc-actions { display: flex; gap: 6px; }
.sqlc-copy {
  display: inline-flex; align-items: center; gap: 5px;
  border: 1px solid var(--border-interactive, #7b8ea8); background: var(--surface-2, #fff);
  border-radius: 6px; padding: 3px 8px; cursor: pointer;
  font-size: 10.5px; font-weight: 600; color: var(--fg-2, #4a5a6e);
}
.sqlc-copy:hover { border-color: var(--primary, #0d4c8b); color: var(--primary, #0d4c8b); }
.sqlc-body {
  margin: 0; padding: 10px 0; max-height: 190px; overflow: auto;
  background: #0f2033; color: #cbd5e1;
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11.5px; line-height: 1.65;
}
.sql-ln { display: flex; align-items: flex-start; }
.sql-gutter {
  flex-shrink: 0; width: 34px; text-align: right; padding-right: 10px;
  color: #4a6076; user-select: none;
}
.sql-code { white-space: pre; padding-right: 12px; }
.sql-code :deep(.kw) { color: #7dd3fc; font-weight: 700; }

/* ══════════════ SQL editor (sql mode) ══════════════ */
.sqled { display: flex; flex-direction: column; gap: 8px; }
.sqled-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.sqled-chk {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; color: var(--success-fg, #146c33); cursor: pointer;
}
.sqled-chk.warn { color: var(--danger-fg, #b42318); }
.sqled-chk input { width: 13px; height: 13px; accent-color: var(--primary, #0d4c8b); cursor: pointer; }
.sqled-rows { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--fg-3, #586778); }
.sqled-rows .ctl { width: 78px; padding: 4px 6px; }

.sqled-wrap {
  display: flex;
  border: 1px solid var(--border-interactive, #7b8ea8);
  border-radius: var(--r-sm, 8px);
  overflow: hidden;
  background: #0f2033;
}
.sqled-wrap:focus-within { border-color: var(--primary, #0d4c8b); box-shadow: 0 0 0 3px var(--primary-wash-strong, rgba(13, 76, 139, .12)); }
.sqled-gutter {
  flex-shrink: 0; width: 40px; overflow: hidden;
  background: #0b1826; padding: 10px 0;
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; line-height: 1.6;
}
.sqled-gutter > div { display: flex; flex-direction: column; }
.sqled-gutter span { text-align: right; padding-right: 10px; color: #47607a; }
.sqled-area {
  flex: 1; min-width: 0; min-height: 220px; resize: vertical;
  border: none; outline: none; background: transparent;
  padding: 10px 12px; color: #e2e8f0;
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; line-height: 1.6;
  white-space: pre; tab-size: 2;
}
.sqled-area::placeholder { color: #47607a; }
.sqled-note { font-size: 10.5px; color: var(--fg-3, #586778); line-height: 1.6; }
.sqled-note kbd {
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 9.5px;
  background: var(--surface-sunken, #dce3ec); border: 1px solid var(--border-subtle, #d5dee9);
  border-radius: 3px; padding: 0 4px;
}

/* ══════════════ Results ══════════════ */
.res-head { align-items: flex-start; min-height: 52px; }
.res-head-l { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.res-meta { font-size: 11.5px; color: var(--fg-3, #586778); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.res-meta strong { color: var(--fg-1, #16202b); font-variant-numeric: tabular-nums; }
.res-meta .dot { color: var(--border-strong, #b8c0c9); }
.res-flash { display: inline-flex; align-items: center; gap: 3px; color: var(--success-fg, #146c33); font-weight: 600; }
.res-flash.rolled { color: var(--warning-fg, #8a5a00); }
.res-head-r { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.split { position: relative; display: inline-flex; }
.split .btn { padding: 5px 10px; font-size: 11.5px; }
.split .btn:not(.split-caret) { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.split .split-caret { padding: 5px 6px; border-left: none; border-top-left-radius: 0; border-bottom-left-radius: 0; }

.res-scroll { padding: 0; overflow: auto; }
.res-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; min-height: 260px; padding: 24px;
  color: var(--fg-3, #94a3b8); font-size: 12.5px; text-align: center;
}
.res-state svg { color: var(--border-strong, #cbd5e1); }
.res-state.err svg { color: var(--danger-fg, #b42318); }
.res-state.err span { color: var(--danger-fg, #b42318); max-width: 520px; }
.spinner {
  width: 20px; height: 20px; border-radius: 50%;
  border: 2px solid var(--border-subtle, #e2e8f0); border-top-color: var(--primary, #0d4c8b);
  animation: qb-spin .7s linear infinite;
}

.trunc-banner {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--warning-fg, #8a5a00);
  background: var(--warning-bg, rgba(138, 90, 0, .12));
  padding: 6px 12px; border-bottom: 1px solid rgba(138, 90, 0, .2);
}

.affected { padding: 16px; }
.affected-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.affected-head > svg { color: var(--success-fg, #146c33); flex-shrink: 0; }
.affected-n { font-size: 15px; font-weight: 700; color: var(--fg-1, #16202b); }
.affected-sub { font-size: 11.5px; color: var(--fg-3, #586778); margin-top: 2px; }
.stmt-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.stmt-table th {
  text-align: left; padding: 6px 10px; background: var(--surface-sunken, #eef2f7);
  font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--fg-2, #4a5a6e);
  border-bottom: 1px solid var(--border-strong, #b8c0c9);
}
.stmt-table td { padding: 6px 10px; border-bottom: 1px solid var(--border-subtle, #eef2f7); vertical-align: top; }
.stmt-sql { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10.5px; color: var(--fg-2, #4a5a6e); white-space: pre-wrap; word-break: break-word; }

.res-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.res-table th {
  position: sticky; top: 0; z-index: 1;
  background: var(--surface-sunken, #eef2f7); cursor: pointer;
  padding: 8px 12px; text-align: left; white-space: nowrap;
  font-size: 10px; text-transform: uppercase; letter-spacing: .05em;
  color: var(--fg-2, #4a5a6e); font-weight: 700;
  border-bottom: 1px solid var(--border-strong, #b8c0c9);
}
.res-table th span { margin-right: 4px; }
.th-ic { vertical-align: middle; color: var(--primary, #0d4c8b); }
.th-ic.dim { color: var(--border-strong, #b8c0c9); }
.res-table td {
  padding: 7px 12px; border-bottom: 1px solid var(--border-subtle, #eef2f7);
  white-space: nowrap; color: var(--fg-1, #16202b); vertical-align: middle;
}
.res-table tbody tr:hover td { background: var(--surface-1, #f8fafc); }
.c-null { color: var(--fg-3, #b8c0c9); }
.c-mono {
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10.5px;
  color: var(--fg-2, #4a5a6e); display: inline-block; max-width: 200px;
  overflow: hidden; text-overflow: ellipsis; vertical-align: bottom;
}
.pill {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: var(--r-pill, 999px);
  font-size: 10px; font-weight: 700; text-transform: lowercase; letter-spacing: .02em;
  border: 1px solid transparent;
}
.pill-danger { background: var(--danger-bg, rgba(180, 35, 24, .1)); color: var(--danger-fg, #b42318); border-color: color-mix(in srgb, var(--danger-fg, #b42318) 25%, transparent); }
.pill-warning { background: var(--warning-bg, rgba(138, 90, 0, .12)); color: var(--warning-fg, #8a5a00); border-color: color-mix(in srgb, var(--warning-fg, #8a5a00) 25%, transparent); }
.pill-info { background: var(--info-bg, rgba(13, 76, 139, .1)); color: var(--info-fg, #0d4c8b); border-color: color-mix(in srgb, var(--info-fg, #0d4c8b) 25%, transparent); }
.pill-success { background: var(--success-bg, rgba(20, 108, 51, .12)); color: var(--success-fg, #146c33); border-color: color-mix(in srgb, var(--success-fg, #146c33) 25%, transparent); }
.pill-neutral { background: var(--surface-sunken, #eef2f7); color: var(--fg-2, #4a5a6e); border-color: var(--border-subtle, #d5dee9); }

.res-pager {
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 9px 14px; border-top: 1px solid var(--border-subtle, #d5dee9);
  background: var(--surface-1, #f8fafc); flex-wrap: wrap;
}
.pg-size { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--fg-3, #586778); }
.pg-size .ctl { width: auto; padding: 3px 6px; }
.pg-nav { display: flex; align-items: center; gap: 3px; }
.pg {
  min-width: 26px; height: 26px; padding: 0 6px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--border-subtle, #d5dee9); border-radius: 6px;
  background: var(--surface-2, #fff); cursor: pointer; font-size: 11.5px; color: var(--fg-2, #4a5a6e);
}
.pg:hover:not(:disabled):not(.active) { border-color: var(--primary, #0d4c8b); color: var(--primary, #0d4c8b); }
.pg.active { background: var(--primary, #0d4c8b); border-color: var(--primary, #0d4c8b); color: #fff; font-weight: 700; }
.pg.gap { border: none; background: transparent; cursor: default; }
.pg:disabled { opacity: .4; cursor: not-allowed; }
</style>
