# lab7-qa-skill · 推荐设计模式与六大反模式

## 推荐模式 (Best Practices)
1. **法拉第屏蔽笼模式 (Faraday Cage Pattern)**：在双层或多层板外边沿，以 2.5~3.5mm 间距环绕布置一圈接地缝合过孔，大幅提高金属壳体内的 ESD/EMI 免疫力。
2. **热回路最小化模式 (Hot-Loop Minimization)**：DCDC 输入电容 -> 上管/下管 -> 电感 -> 输出电容构成的交流脉冲回路面积必须最小。
3. **45° 钝角折线模式 (Chamfering Pattern)**：所有转角平滑为 135° 钝角，彻底消除直角酸角与高频阻抗突变。

## 六大反模式 (Anti-Patterns to Avoid)
1. **反模式 1：直角走线 (Right-Angle Acid Trap)**
2. **反模式 2：悬空孤铜 (Floating Dead Copper Island)**
3. **反模式 3：参考平面跨分割 (Crossing Plane Splits)**
4. **反模式 4：反馈线紧贴电感 (FB Sensitive Node Near SW Node)**
5. **反模式 5：去耦电容远离引脚 (Decoupling Capacitor Placed Far From IC)**
6. **反模式 6：裸铜焊盘混入 SMT 贴片坐标表 (Ghost Pads in Pick-and-Place)**
