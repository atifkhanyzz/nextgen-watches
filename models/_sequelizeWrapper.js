// Helper to wrap Sequelize models with a Mongoose-like API used in the project
module.exports = function createWrapper(Model) {
  function Wrapper(data = {}) {
    const instance = Model.build(data);
    const instanceRef = { value: instance };
    const proxy = new Proxy({}, {
      get(_, prop) {
        const target = instanceRef.value;
        if (!target) return undefined;
        if (prop === 'save') {
          return async function () {
            const saved = await target.save();
            instanceRef.value = saved;
            return proxy;
          };
        }
        if (prop === 'toObject') {
          return () => target.get({ plain: true });
        }
        if (prop === '_id') return target.id;
        if (prop in target) return target[prop];
        if (target.dataValues && prop in target.dataValues) return target.get(prop);
        return undefined;
      },
      set(_, prop, value) {
        // special-case _instance assignment to update our reference
        if (prop === '_instance') {
          instanceRef.value = value;
          return true;
        }
        const target = instanceRef.value;
        if (!target) return false;
        if (target.rawAttributes && prop in target.rawAttributes) {
          target.set(prop, value);
        } else {
          target[prop] = value;
        }
        return true;
      }
    });

    proxy._instance = instance;
    return proxy;
  }

  // static methods
  Wrapper.findOne = async function (filter) {
    // reject queries with undefined values to avoid invalid WHERE clauses
    if (filter && typeof filter === 'object') {
      for (const k of Object.keys(filter)) {
        if (filter[k] === undefined) return null;
      }
    }
    const where = filter || {};
    const row = await Model.findOne({ where });
    if (!row) return null;
    const w = new Wrapper();
    w._instance = row;
    return w;
  };

  Wrapper.find = async function (filter) {
    if (filter && typeof filter === 'object') {
      for (const k of Object.keys(filter)) {
        if (filter[k] === undefined) return [];
      }
    }
    const where = filter || {};
    const rows = await Model.findAll({ where });
    return rows.map(row => {
      const w = new Wrapper();
      w._instance = row;
      return w;
    });
  };

  Wrapper.findById = async function (id) {
    const row = await Model.findByPk(id);
    if (!row) return null;
    const w = new Wrapper();
    w._instance = row;
    return w;
  };

  Wrapper.create = async function (data) {
    const row = await Model.create(data);
    const w = new Wrapper();
    w._instance = row;
    return w;
  };

  Wrapper.updateOne = async function (filter, update) {
    if (filter && typeof filter === 'object') {
      for (const k of Object.keys(filter)) {
        if (filter[k] === undefined) return;
      }
    }
    const where = filter || {};
    await Model.update(update, { where });
  };

  Wrapper.findOneAndUpdate = async function (filter, update) {
    if (filter && typeof filter === 'object') {
      for (const k of Object.keys(filter)) {
        if (filter[k] === undefined) return null;
      }
    }
    const where = filter || {};
    const row = await Model.findOne({ where });
    if (!row) return null;
    await row.update(update);
    const w = new Wrapper();
    w._instance = row;
    return w;
  };

  Wrapper.findByIdAndUpdate = async function (id, update) {
    const row = await Model.findByPk(id);
    if (!row) return null;
    await row.update(update);
    const w = new Wrapper();
    w._instance = row;
    return w;
  };

  Wrapper.deleteOne = async function (filter) {
    if (filter && typeof filter === 'object') {
      for (const k of Object.keys(filter)) {
        if (filter[k] === undefined) return;
      }
    }
    const where = filter || {};
    await Model.destroy({ where });
  };

  // expose raw Sequelize model for advanced queries
  Wrapper._Model = Model;

  return Wrapper;
};
